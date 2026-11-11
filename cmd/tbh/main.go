// Command tbh runs The Better Handbook.
//
//	tbh serve                 run the web server (default)
//	tbh import <slug>... | all  import units from university handbooks
//	tbh backup <file>         write a consistent copy of the database
//
// Configuration comes from environment variables; see .env.example.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/config"
	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/all"
	"github.com/lachlanmacphee/thebetterhandbook/internal/mail"
	"github.com/lachlanmacphee/thebetterhandbook/internal/web"
)

const usage = `usage:
  tbh serve                     run the web server (default)
  tbh import <slug>... | all    import units from university handbooks
  tbh backup <file>             write a consistent copy of the database

universities: %s
`

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, os.Args[1:], log); err != nil {
		log.Error(err.Error())
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, log *slog.Logger) error {
	cmd := "serve"
	if len(args) > 0 {
		cmd, args = args[0], args[1:]
	}
	if cmd == "help" || cmd == "-h" || cmd == "--help" {
		fmt.Printf(usage, strings.Join(all.Slugs(), ", "))
		return nil
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DatabasePath), 0o755); err != nil {
		return err
	}
	conn, err := db.Open(cfg.DatabasePath)
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := db.Migrate(ctx, conn); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	switch cmd {
	case "serve":
		if err := cfg.ValidateServer(); err != nil {
			return err
		}
		srv, err := web.New(web.Options{
			DB:            conn,
			Mail:          mail.New(cfg.Email, log),
			Log:           log,
			SessionSecret: cfg.SessionSecret,
			Dev:           cfg.Dev,
		})
		if err != nil {
			return err
		}
		return serve(ctx, cfg.Addr, srv.Handler(), log)

	case "import":
		slugs := args
		if len(slugs) == 1 && slugs[0] == "all" {
			slugs = all.Slugs()
		}
		if len(slugs) == 0 {
			return fmt.Errorf(usage, strings.Join(all.Slugs(), ", "))
		}
		for _, slug := range slugs {
			newImporter, ok := all.Importers[slug]
			if !ok {
				return fmt.Errorf("unknown university %q (choose from: %s)", slug, strings.Join(all.Slugs(), ", "))
			}
			uniLog := log.With("university", slug)
			if err := importer.Run(ctx, conn, newImporter(uniLog), uniLog); err != nil {
				return err
			}
		}
		return nil

	case "backup":
		if len(args) != 1 {
			return errors.New("usage: tbh backup <file>")
		}
		if _, err := os.Stat(args[0]); err == nil {
			return fmt.Errorf("%s already exists", args[0])
		}
		// VACUUM INTO writes a consistent snapshot without blocking readers.
		if _, err := conn.ExecContext(ctx, "VACUUM INTO ?", args[0]); err != nil {
			return fmt.Errorf("backup: %w", err)
		}
		log.Info("backup written", "file", args[0])
		return nil
	}

	return fmt.Errorf("unknown command %q\n\n"+usage, cmd, strings.Join(all.Slugs(), ", "))
}

func serve(ctx context.Context, addr string, h http.Handler, log *slog.Logger) error {
	srv := &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", addr)
		errc <- srv.ListenAndServe()
	}()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
