// Package all registers every university importer by slug.
package all

import (
	"maps"
	"slices"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/adelaide"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/anu"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/monash"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/unimelb"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/unsw"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/uq"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/usyd"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer/uwa"
)

// Importers maps each university slug to its importer constructor.
var Importers = map[string]importer.Constructor{
	"australian-national-university":  anu.New,
	"monash-university":               monash.New,
	"university-of-adelaide":          adelaide.New,
	"university-of-melbourne":         unimelb.New,
	"university-of-new-south-wales":   unsw.New,
	"university-of-queensland":        uq.New,
	"university-of-sydney":            usyd.New,
	"university-of-western-australia": uwa.New,
}

// Slugs returns every registered slug in sorted order.
func Slugs() []string {
	return slices.Sorted(maps.Keys(Importers))
}
