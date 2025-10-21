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
        student feedback, the information in them is very high level and often
        not very helpful when trying to decide which units to take.
        <br />
        <br />
        So, instead of having to search across Reddit and Discorcd for reviews,
        I created this site for students to share their unit/subject experiences
        with others. You can share what the workload was like, whether you could
        attend entirely online, or how good the teaching quality was. If this
        site can benefit one student in making a more informed decision about
        their course selections, then I'll consider it a success!
        <br />
        <br />A side note: if you're an IT/Comp Sci/Eng student with some
        technical know how, I've made this site completely open source, and
        designed it in a way that it'd be very easy for any student to help
        maintain it or start supporting another University. I hope that future
        students might help me to create a lasting resource that will continue
        to serve Australian University students for years to come.
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
