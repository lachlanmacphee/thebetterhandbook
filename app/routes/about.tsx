export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
        <div className="card-body p-6 md:p-8">
          <h1 className="text-4xl font-bold mb-6">About The Better Handbook</h1>

          <div className="space-y-6 text-base-content/80">
            <section>
              <h2 className="text-2xl font-semibold mb-3">The Project</h2>
              <p>
                The Better Handbook is an independent and open-source platform
                designed to help Monash University students make informed
                decisions about their unit selections. It provides a space for
                students to search through units based on a variety of filters,
                share their experiences, and read honest reviews about different
                units across all faculties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">The Creator</h2>
              <p>
                Hi! I'm Lachlan MacPhee, a Monash University student who created
                The Better Handbook to address the challenges around finding
                units you'll like. I noticed that while the handbook has
                important information, it's hard to search through and doesn't
                capture the real student experience. The Better Handbook aims to
                bridge this gap by providing advanced search functionality, peer
                insights about workload, teaching quality, and overall unit
                experience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">Open Source</h2>
              <p>
                The Better Handbook is completely open source, meaning anyone
                can view, contribute to, or learn from its code. I believe in
                transparency and community-driven development, which is why the
                entire project is available on{" "}
                <a
                  href="https://github.com/lachlanmacphee/the-better-handbook"
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
              <p>
                This platform is designed exclusively for Monash students,
                requiring a valid Monash student email to participate. This
                ensures that reviews come from actual students who have taken
                the units they're reviewing.{" "}
                <strong>
                  This site has no affiliation with Monash University and I am
                  more than happy to chat with them if they see any potential
                  issues with it.
                </strong>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
