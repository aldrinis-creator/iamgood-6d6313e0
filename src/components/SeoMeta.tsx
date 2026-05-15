import { Helmet } from "react-helmet-async";

interface SeoMetaProps {
  title: string;
  description: string;
  keywords?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  canonicalPath?: string;
}

const BASE_URL = "https://iamgood.lovable.app";

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

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      {canonical && <link rel="canonical" href={canonical} />}
      {canonical && <meta property="og:url" content={canonical} />}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SeoMeta;
