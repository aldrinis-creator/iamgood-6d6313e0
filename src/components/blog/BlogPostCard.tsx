import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { BlogPost } from "@/data/blogPosts";

export const BlogPostCard = ({ post }: { post: BlogPost }) => (
  <Link to={`/blog/${post.slug}`} className="block">
    <Card className="h-full hover:border-primary/50 transition-colors">
      <CardContent className="p-5 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {post.topic}
        </div>
        <h2 className="text-lg font-bold leading-snug">{post.title}</h2>
        <p className="text-base text-muted-foreground leading-relaxed">{post.excerpt}</p>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          <span>{post.readTimeMin} min read</span>
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default BlogPostCard;
