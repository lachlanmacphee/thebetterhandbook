export default function About() {
  return (
    <section>
      <h1>About</h1>
      <p>
        Hi! I'm Lachlan MacPhee, a Monash University student who created The
        Better Handbook to address the challenges around finding units you'll
        like. I noticed that while the handbook has important information, it's
        hard to search through and doesn't capture the real student experience.
        The Better Handbook aims to bridge this gap by providing advanced search
        functionality, peer insights about workload, teaching quality, and
        overall unit experience.
      </p>

      <strong>Credits</strong>
      <p>
        Shoutout to{" "}
        <a
          href="https://www.saikumarmk.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sai
        </a>{" "}
        whose work to develop the{" "}
        <a
          href="https://github.com/saikumarmk/monash-handbook-scraper"
          target="_blank"
          rel="noopener noreferrer"
        >
          handbook scraper
        </a>{" "}
        inspired me to start this project. I used some of his scraping
        techniques to write my own import system. Another shoutout to the
        MonSTAR team for giving me the idea and go-ahead to create an
        independent, open-source alternative.
      </p>

      <strong>Open Source</strong>
      <p>
        The Better Handbook is completely open source, meaning anyone can view,
        contribute to, or learn from its code. I believe in transparency and
        community-driven development, which is why the entire project is
        available on{" "}
        <a
          href="https://github.com/lachlanmacphee/thebetterhandbook"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </p>

      <strong>For Students, By Students</strong>
      <p>
        This platform is designed exclusively for Monash students, requiring a
        valid Monash student email to participate. This ensures that reviews
        come from actual students who have taken the units they're reviewing.
      </p>
    </section>
  );
}
