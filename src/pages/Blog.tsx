import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SeoMeta from "@/components/SeoMeta";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS } from "@/data/blogPosts";
import BlogPostCard from "@/components/blog/BlogPostCard";

const TOPICS = [
  "Medication Reminders",
  "Elderly Care",
  "Senior Safety",
  "Emergency Alerts",
] as const;

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <SeoMeta
        title="Check-iN Blog — Elderly Care, Medication & Senior Safety in India"
        description="Practical guides for Indian families caring for elderly parents — medication reminders, senior safety, emergency alerts, and remote caregiving."
        canonicalPath="/blog"
      />
      <div className="max-w-[800px] mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Home</Link>
        </Button>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Check-iN Blog</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Honest, India-focused guides on caring for elderly parents — medication
            adherence, daily safety, emergency response, and remote caregiving.
          </p>
        </header>

        {TOPICS.map((topic) => {
          const posts = BLOG_POSTS.filter((p) => p.topic === topic);
          if (!posts.length) return null;
          return (
            <section key={topic} className="mb-8">
              <h2 className="text-xl font-bold mb-3">{topic}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => (
                  <BlogPostCard key={p.slug} post={p} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default Blog;
