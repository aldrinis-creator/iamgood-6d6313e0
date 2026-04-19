import AppLayout from "@/components/AppLayout";
import HealthServices from "@/components/HealthServices";

const Services = () => (
  <AppLayout>
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Services</h1>
      <HealthServices />
    </div>
  </AppLayout>
);

export default Services;
