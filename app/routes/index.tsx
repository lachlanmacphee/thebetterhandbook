export default function Index() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h1>Choose your University</h1>
      <div className="grid">
        <a href="/3">
          <article style={{ marginBottom: 0 }}>
            Australian National University
          </article>
        </a>
        <a href="/1">
          <article style={{ marginBottom: 0 }}>Monash University</article>
        </a>
      </div>
      <div className="grid">
        <a href="/4">
          <article style={{ marginBottom: 0 }}>University of Adelaide</article>
        </a>
        <a href="/2">
          <article style={{ marginBottom: 0 }}>University of Melbourne</article>
        </a>
      </div>
      <div className="grid">
        <a href="/5">
          <article style={{ marginBottom: 0 }}>
            University of New South Wales
          </article>
        </a>
        <a href="/6">
          <article style={{ marginBottom: 0 }}>
            University of Queensland
          </article>
        </a>
      </div>
      <div className="grid">
        <a href="/7">
          <article style={{ marginBottom: 0 }}>University of Sydney</article>
        </a>
        <a href="/8">
          <article style={{ marginBottom: 0 }}>
            University of Western Australia
          </article>
        </a>
      </div>
    </div>
  );
}
