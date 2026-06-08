import Image from "next/image";

type BrandLogoProps = {
  size?: "small" | "default";
};

export default function BrandLogo({ size = "default" }: BrandLogoProps) {
  const pixels = size === "small" ? 34 : 44;

  return (
    <span className={size === "small" ? "brand-mark small" : "brand-mark"}>
      <Image src="/sa-logo.png" alt="" width={pixels} height={pixels} priority={false} />
    </span>
  );
}
