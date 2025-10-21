export default function About() {
  return (
    <section>
      <h1>About</h1>
      <p>
        Hi there! I'm Lachlan MacPhee, a student at Monash University and the
        creator of The Better Handbook.
        <br />
        <br />
        I've had some incredible learning experiences during my time at Monash
        University, with so many "wow" moments I wouldn't be able to count them.
        However, I've also encountered my fair share of disappointing units
        where there was major room for improvement in how they were structured
        and delivered. While SETU is an important mechanism for gathering
        student feedback, the information released is very high level and often
        not very helpful when trying to decide which units to take.
        <br />
        <br />
        So, instead of having to search across Reddit and Discord for reviews, I
        created this site for students of Australian Universities to share their
        experiences with others. You can share what the workload was like,
        whether you could attend entirely online, or what the teaching was like,
        amongst many other things. If this site can benefit one student in
        making a more informed decision about their course selections, then I'll
        consider it a success!
      </p>

      <h2>Credits</h2>
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

      <h2>Open Source</h2>
      <p>
        The Better Handbook is completely open source, meaning anyone can view,
        contribute to, or learn from its code. The entire project is available
        on{" "}
        <a
          href="https://github.com/lachlanmacphee/thebetterhandbook"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        . If you're a student with some technical know-how, I've designed this
        site in such a way that it's easy to maintain, or add support for
        another University. I hope that you, or other future students, might
        help me to create a lasting resource that will continue to serve
        University students for years to come.
      </p>
    </section>
  );
}
