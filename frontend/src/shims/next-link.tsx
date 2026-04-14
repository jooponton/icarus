import type { AnchorHTMLAttributes, ReactNode } from "react";

type NextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  as?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  prefetch?: boolean;
  locale?: string | false;
  legacyBehavior?: boolean;
  children?: ReactNode;
};

export default function Link({
  href,
  as: _as,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  prefetch: _prefetch,
  locale: _locale,
  legacyBehavior: _legacyBehavior,
  children,
  ...rest
}: NextLinkProps) {
  const resolvedHref =
    typeof href === "string" ? href : href.pathname ?? "#";
  return (
    <a href={resolvedHref} {...rest}>
      {children}
    </a>
  );
}
