import { useEffect } from "react";

const JsonLd = ({ data, id }: { data: unknown; id: string }) => {
  useEffect(() => {
    let el = document.head.querySelector<HTMLScriptElement>(`script[data-jsonld="${id}"]`);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-jsonld", id);
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      el?.remove();
    };
  }, [data, id]);

  return null;
};

export default JsonLd;
