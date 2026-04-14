import type { SiteItem } from "../store/projectStore";
import { SITE_ITEM_CATALOG } from "../lib/siteItemCatalog";

interface Props {
  items: SiteItem[];
}

export default function SiteItems({ items }: Props) {
  if (!items || items.length === 0) return null;
  return (
    <group>
      {items.map((item, i) => {
        const meta = SITE_ITEM_CATALOG[item.type];
        if (!meta) return null;
        return (
          <group
            key={`${item.type}-${i}`}
            position={item.position}
            rotation={[0, item.rotation_y, 0]}
            scale={item.scale}
          >
            {meta.render()}
          </group>
        );
      })}
    </group>
  );
}
