import type { ImgHTMLAttributes } from "react";

type NextImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string };
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  unoptimized?: boolean;
  loader?: (args: { src: string; width: number; quality?: number }) => string;
};

export default function Image({
  src,
  width,
  height,
  fill,
  priority: _priority,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  quality: _quality,
  unoptimized: _unoptimized,
  loader: _loader,
  style,
  alt = "",
  ...rest
}: NextImageProps) {
  const resolvedSrc = typeof src === "string" ? src : src.src;
  const fillStyle = fill
    ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const, ...style }
    : style;
  return (
    <img
      src={resolvedSrc}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={fillStyle}
      alt={alt}
      {...rest}
    />
  );
}
