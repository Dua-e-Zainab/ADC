// src/components/ui/UBLLogo.jsx
import ublLogo from "../../assets/ubl logo.png";

export default function UBLLogo() {
  return (
    <img
      src={ublLogo}
      alt="UBL"
      style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8 }}
    />
  );
}