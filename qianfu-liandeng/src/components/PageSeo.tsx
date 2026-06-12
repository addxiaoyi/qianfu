import React, { useEffect } from 'react';

type PageSeoProps = {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: string;
  image?: string;
  schema?: Record<string, unknown> | null;
};

const SITE_URL = 'https://mc-u.top';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

function upsertMeta(selector: string, key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(key, value);
    document.head.appendChild(tag);
  } else {
    tag.setAttribute(key, value);
  }
  return tag;
}

function setLinkRel(rel: string, href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

const PageSeo: React.FC<PageSeoProps> = ({ title, description, canonicalPath, robots = 'index,follow', image, schema }) => {
  useEffect(() => {
    const absoluteUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : SITE_URL;
    const finalImage = image || DEFAULT_IMAGE;

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description').content = description;
    upsertMeta('meta[name="robots"]', 'name', 'robots').content = robots;
    upsertMeta('meta[property="og:title"]', 'property', 'og:title').content = title;
    upsertMeta('meta[property="og:description"]', 'property', 'og:description').content = description;
    upsertMeta('meta[property="og:url"]', 'property', 'og:url').content = absoluteUrl;
    upsertMeta('meta[property="og:image"]', 'property', 'og:image').content = finalImage;
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title').content = title;
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description').content = description;
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image').content = finalImage;
    setLinkRel('canonical', absoluteUrl);

    let schemaTag = document.head.querySelector<HTMLScriptElement>('script[data-page-seo-schema="true"]');
    if (schema) {
      if (!schemaTag) {
        schemaTag = document.createElement('script');
        schemaTag.type = 'application/ld+json';
        schemaTag.dataset.pageSeoSchema = 'true';
        document.head.appendChild(schemaTag);
      }
      schemaTag.textContent = JSON.stringify({
        ...schema,
        name: (schema as Record<string, unknown>).name ?? title,
        url: absoluteUrl,
        image: finalImage,
      });
    } else if (schemaTag) {
      schemaTag.remove();
    }
  }, [title, description, canonicalPath, robots, image, schema]);

  return null;
};

export default PageSeo;
