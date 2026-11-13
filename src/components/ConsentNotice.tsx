import { Link } from "react-router-dom";

const ConsentNotice = () => (
  <p className="text-center text-[12px] text-auth-text-3 leading-relaxed mt-1">
    By continuing, you agree to our{" "}
    <Link to="/terms-of-service" className="text-auth-green underline">Terms of Service</Link>{" "}
    and{" "}
    <Link to="/privacy-policy" className="text-auth-green underline">Privacy Policy</Link>.
  </p>
);

export default ConsentNotice;
