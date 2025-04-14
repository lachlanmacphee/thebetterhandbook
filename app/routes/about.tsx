export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
        <div className="card-body p-6 md:p-8">
          <h1 className="text-4xl font-bold mb-8 text-center">About</h1>

          <div className="grid md:grid-cols-[1fr,2fr] gap-8 mb-8">
            <div className="flex flex-col items-center space-y-4">
              <img
                src="https://github.com/lachlanmacphee.png"
                alt="Lachlan MacPhee"
                className="w-48 h-48 rounded-full shadow-lg border-4 border-primary"
              />
              <div className="text-center">
                <h2 className="text-2xl font-semibold">Lachlan MacPhee</h2>
                <p className="text-base-content/70">Creator & Developer</p>
                <a
                  href="https://github.com/lachlanmacphee"
                  className="inline-flex items-center gap-2 text-primary hover:underline mt-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub Profile
                </a>
              </div>
            </div>

            <div className="p-4 bg-warning/20 border-2 border-warning rounded-lg">
              <h2 className="text-2xl font-bold mb-2 text-warning">
                Important Disclaimer
              </h2>
              <p className="text-lg font-semibold">
                This website has absolutely zero affiliation with Monash
                University. This is an independent, student-created platform.
              </p>
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-3">About Me</h2>
                <p className="text-base-content/80">
                  Hi! I'm Lachlan MacPhee, a Monash University student who
                  created The Better Handbook to address the challenges around
                  finding units you'll like. I noticed that while the handbook
                  has important information, it's hard to search through and
                  doesn't capture the real student experience. The Better
                  Handbook aims to bridge this gap by providing advanced search
                  functionality, peer insights about workload, teaching quality,
                  and overall unit experience.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">The Project</h2>
                <p className="text-base-content/80">
                  The Better Handbook is an independent and open-source platform
                  designed to help Monash University students make informed
                  decisions about their unit selections. It provides a space for
                  students to search through units based on a variety of
                  filters, share their experiences, and read honest reviews
                  about different units across all faculties.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">Credits</h2>
                <p>
                  Shoutout to{" "}
                  <a
                    href="https://www.saikumarmk.com/"
                    className="text-primary hover:underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sai
                  </a>{" "}
                  whose work to develop the{" "}
                  <a
                    href="https://github.com/saikumarmk/monash-handbook-scraper"
                    className="text-primary hover:underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    handbook scraper
                  </a>{" "}
                  is the reason this is possible. Another shoutout to the
                  MonSTAR team for giving me the idea and the go-ahead to create
                  an independent, open-source alternative.
                </p>
              </section>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 border-t border-base-300 pt-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">Open Source</h2>
              <p className="text-base-content/80">
                The Better Handbook is completely open source, meaning anyone
                can view, contribute to, or learn from its code. I believe in
                transparency and community-driven development, which is why the
                entire project is available on{" "}
                <a
                  href="https://github.com/lachlanmacphee/thebetterhandbook"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">
                For Students, By Students
              </h2>
              <p className="text-base-content/80">
                This platform is designed exclusively for Monash students,
                requiring a valid Monash student email to participate. This
                ensures that reviews come from actual students who have taken
                the units they're reviewing.{" "}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
