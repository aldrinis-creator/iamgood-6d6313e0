import NavTabs from "@/components/NavTabs";
import VoiceAgentButton from "@/components/VoiceAgentButton";

const NavTest = () => (
  <div className="dark min-h-screen bg-background text-foreground">
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background relative">
      <main className="flex-1 p-4 space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-12 bg-card rounded" />
        ))}
      </main>
      <NavTabs />
      <VoiceAgentButton persona="user" />
    </div>
  </div>
);

export default NavTest;
