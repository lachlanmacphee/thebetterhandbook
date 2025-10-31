import type { Route } from "./+types/index";

export default function Index({ loaderData, params }: Route.ComponentProps) {
  return (
    <>
      <h1>Choose your University</h1>
      <div className="grid">
        <a href="/1">
          <article>Monash University</article>
        </a>
        {/*<a href="/2">
          <article>University of Melbourne</article>
        </a>*/}
      </div>
    </>
  );
}
