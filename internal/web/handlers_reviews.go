package web

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

// reviewInput is the review form, as submitted or as loaded for editing.
type reviewInput struct {
	Title, Text                                            string
	Year, Overall, Teaching, Content, Difficulty, Workload int
	Attendance, WAMBooster                                 bool
}

func reviewInputFrom(rv db.Review) reviewInput {
	return reviewInput{
		Title: rv.Title, Text: rv.Text, Year: int(rv.YearCompleted),
		Overall: int(rv.OverallRating), Teaching: int(rv.TeachingRating), Content: int(rv.ContentRating),
		Difficulty: int(rv.DifficultyRating), Workload: int(rv.WorkloadRating),
		Attendance: rv.RequiresAttendance, WAMBooster: rv.IsWamBooster,
	}
}

func parseReviewInput(r *http.Request) (reviewInput, map[string]string) {
	in := reviewInput{
		Title:      strings.TrimSpace(r.PostFormValue("title")),
		Text:       strings.TrimSpace(r.PostFormValue("description")),
		Year:       atoiDefault(r.PostFormValue("yearCompleted"), 0),
		Overall:    atoiDefault(r.PostFormValue("overallRating"), 0),
		Teaching:   atoiDefault(r.PostFormValue("teachingRating"), 0),
		Content:    atoiDefault(r.PostFormValue("contentRating"), 0),
		Difficulty: atoiDefault(r.PostFormValue("difficultyRating"), 0),
		Workload:   atoiDefault(r.PostFormValue("workloadRating"), 0),
		Attendance: r.PostFormValue("attendanceRequired") == "on",
		WAMBooster: r.PostFormValue("isWamBooster") == "on",
	}
	errs := map[string]string{}
	if in.Title == "" {
		errs["title"] = "Title is required"
	}
	if in.Text == "" {
		errs["description"] = "Description is required"
	}
	if in.Year < 2000 || in.Year > time.Now().Year() {
		errs["yearCompleted"] = "Please enter a valid year"
	}
	for field, v := range map[string]int{
		"overallRating": in.Overall, "teachingRating": in.Teaching, "contentRating": in.Content,
		"difficultyRating": in.Difficulty, "workloadRating": in.Workload,
	} {
		if v < 1 || v > 5 {
			errs[field] = "Please choose a rating"
		}
	}
	return in, errs
}

// reviewForm shows the create form, or the edit form if the user has already
// reviewed this unit (a user can only review each unit once).
func (s *Server) reviewForm(w http.ResponseWriter, r *http.Request) {
	uni, unit, ok := s.unitFromPath(w, r)
	if !ok {
		return
	}
	existing, err := s.q.GetUserReviewForUnit(r.Context(), db.GetUserReviewForUnitParams{UserID: viewerID(r), UnitID: unit.ID})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.serverError(w, r, err)
		return
	}
	editing := err == nil
	form := reviewInput{}
	if editing {
		form = reviewInputFrom(existing)
	}
	s.render(w, r, http.StatusOK, "review_form", data{
		"University": uni, "Unit": unit, "URL": unitURL(uni.Slug, unit.Code),
		"Editing": editing, "Form": form, "Errors": map[string]string{},
	})
}

func (s *Server) saveReview(w http.ResponseWriter, r *http.Request) {
	uni, unit, ok := s.unitFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	userID := viewerID(r)
	existing, err := s.q.GetUserReviewForUnit(ctx, db.GetUserReviewForUnitParams{UserID: userID, UnitID: unit.ID})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.serverError(w, r, err)
		return
	}
	editing := err == nil

	in, errs := parseReviewInput(r)
	if len(errs) > 0 {
		s.render(w, r, http.StatusUnprocessableEntity, "review_form", data{
			"University": uni, "Unit": unit, "URL": unitURL(uni.Slug, unit.Code),
			"Editing": editing, "Form": in, "Errors": errs,
		})
		return
	}

	if editing {
		err = s.q.UpdateReview(ctx, db.UpdateReviewParams{
			Title: in.Title, Text: in.Text, YearCompleted: int64(in.Year),
			OverallRating: int64(in.Overall), TeachingRating: int64(in.Teaching), ContentRating: int64(in.Content),
			DifficultyRating: int64(in.Difficulty), WorkloadRating: int64(in.Workload),
			RequiresAttendance: in.Attendance, IsWamBooster: in.WAMBooster,
			ID: existing.ID, UserID: userID,
		})
	} else {
		err = s.q.CreateReview(ctx, db.CreateReviewParams{
			Title: in.Title, Text: in.Text, YearCompleted: int64(in.Year),
			OverallRating: int64(in.Overall), TeachingRating: int64(in.Teaching), ContentRating: int64(in.Content),
			DifficultyRating: int64(in.Difficulty), WorkloadRating: int64(in.Workload),
			RequiresAttendance: in.Attendance, IsWamBooster: in.WAMBooster,
			UserID: userID, UnitID: unit.ID,
		})
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	if editing {
		s.flash(r, "success", "Review updated.")
	} else {
		s.flash(r, "success", "Thanks for your review!")
	}
	http.Redirect(w, r, unitURL(uni.Slug, unit.Code), http.StatusSeeOther)
}

// react toggles the signed-in user's like/dislike on a review. Clicking the
// same reaction again removes it.
func (s *Server) react(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	reviewID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		s.notFound(w, r)
		return
	}
	exists, err := s.q.ReviewExists(ctx, reviewID)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	if !exists {
		s.notFound(w, r)
		return
	}
	isLike := r.PostFormValue("reaction") == "like"
	userID := viewerID(r)

	err = db.WithTx(ctx, s.conn, func(q *db.Queries) error {
		current, err := q.GetReaction(ctx, db.GetReactionParams{UserID: userID, ReviewID: reviewID})
		if err == nil && current.IsLike == isLike {
			return q.DeleteReaction(ctx, current.ID)
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		return q.UpsertReaction(ctx, db.UpsertReactionParams{UserID: userID, ReviewID: reviewID, IsLike: isLike})
	})
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	if !isHTMX(r) {
		loc, err := s.q.GetReviewLocation(ctx, reviewID)
		if err != nil {
			s.serverError(w, r, err)
			return
		}
		http.Redirect(w, r, unitURL(loc.UniversitySlug, loc.UnitCode), http.StatusSeeOther)
		return
	}

	counts, err := s.q.GetReviewReactions(ctx, db.GetReviewReactionsParams{ReviewID: reviewID, ViewerID: userID})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.renderFragment(w, r, http.StatusOK, "unit", "reactions", data{
		"ID": reviewID, "Likes": counts.Likes, "Dislikes": counts.Dislikes, "ViewerReaction": counts.ViewerReaction,
	})
}
