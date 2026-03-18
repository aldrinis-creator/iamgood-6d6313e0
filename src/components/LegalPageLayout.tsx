import AppLayout from "@/components/AppLayout";

interface LegalSection {
  heading: string;
  content: string;
}

interface LegalPageLayoutProps {
  title: string;
  sections: LegalSection[];
}

const LegalPageLayout = ({ title, sections }: LegalPageLayoutProps) => {
  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-IN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {section.heading}
            </h2>
            <p className="text-sm text-muted-foreground">{section.content}</p>
          </section>
        ))}
      </div>
    </AppLayout>
  );
};

export default LegalPageLayout;
