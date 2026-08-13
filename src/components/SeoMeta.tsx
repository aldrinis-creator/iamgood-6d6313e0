import { useEffect } from "react";

interface SeoMetaProps {
  title: string;
  description: string;
  keywords?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  canonicalPath?: string;
}

const BASE_URL = "https://iamgood.lovable.app";

const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export const SeoMeta = ({
  title,
  description,
  keywords,
  ogType = "website",
  ogImage = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bd3b8427-acd9-43b7-8236-0ce5c26b8731/id-preview-a0488b66--c08453f9-a772-43a6-ab7c-53dcaa1d84f2.lovable.app-1773854098002.png",
  canonicalPath,
}: SeoMetaProps) => {
  const fullTitle = title.includes("Check-iN") ? title : `${title} — Check-iN`;
  const canonical = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;

  useEffect(() => {
    document.title = fullTitle;
    setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);
    if (canonical) {
      setLink("canonical", canonical);
      setMeta("property", "og:url", canonical);
    }
  }, [fullTitle, description, keywords, ogType, ogImage, canonical]);

  return null;
};

export default SeoMeta;
