import { Link, Navigate, useParams } from "react-router-dom";
import JsonLd from "@/components/JsonLd";
import { ArrowLeft, Clock } from "lucide-react";
import SeoMeta from "@/components/SeoMeta";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BLOG_POSTS, getPostBySlug } from "@/data/blogPosts";
import BlogCTA from "@/components/blog/BlogCTA";
import BlogPostCard from "@/components/blog/BlogPostCard";

const BASE_URL = "https://iamgood.lovable.app";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) return <Navigate to="/blog" replace />;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.datePublished,
    dateModified: post.datePublished,
    author: { "@type": "Organization", name: "Check-iN" },
    publisher: {
      "@type": "Organization",
      name: "Check-iN",
      url: BASE_URL,
    },
    mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const related = post.relatedSlugs
    .map((s) => BLOG_POSTS.find((p) => p.slug === s))
    .filter(Boolean) as typeof BLOG_POSTS;

  return (
    <div className="min-h-screen bg-background safe-top">
      <SeoMeta
        title={post.metaTitle}
        description={post.excerpt}
        keywords={post.keyword}
        ogType="article"
        canonicalPath={`/blog/${post.slug}`}
      />
      <JsonLd id="article" data={articleLd} />
      <JsonLd id="faq" data={faqLd} />

      <div className="max-w-[800px] mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/blog"><ArrowLeft className="w-4 h-4 mr-1" /> All posts</Link>
        </Button>

        <article>
          <header className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
              {post.topic}
            </div>
            <h1 className="text-3xl font-bold text-primary leading-tight mb-3">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{new Date(post.datePublished).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.readTimeMin} min read</span>
            </div>
          </header>

          <p className="text-lg leading-relaxed text-foreground mb-8">{post.intro}</p>

          {post.sections.map((s) => (
            <section key={s.heading} className="mb-8">
              <h2 className="text-2xl font-bold mb-3">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-foreground mb-3">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-3">Frequently asked questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {post.faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-base">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <BlogCTA />

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold mb-3">Read next</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <BlogPostCard key={r.slug} post={r} />
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
};

export default BlogPost;
