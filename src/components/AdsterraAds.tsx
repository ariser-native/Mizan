import React, { useEffect, useMemo, useRef } from 'react';
import { ExternalLink } from 'lucide-react';

export interface BannerSlotConfig {
  id: string;
  key: string;
  width: number;
  height: number;
  src: string;
  label: string;
}

export const ADSTERRA_BANNERS = {
  banner468x60: {
    id: '32379930',
    key: '3efe6183fb456fc209ce3c025f0872c5',
    width: 468,
    height: 60,
    src: 'https://bauval.org/22/3efe6183fb456fc209ce3c025f0872c5',
    label: '468x60 Banner',
  },
  banner160x300: {
    id: '32379931',
    key: '03b44bd7af07b6cd1cc6be6bd6ef0eef',
    width: 160,
    height: 300,
    src: 'https://bauval.org/22/03b44bd7af07b6cd1cc6be6bd6ef0eef',
    label: '160x300 Sidebar Banner',
  },
  banner320x50: {
    id: '32379932',
    key: '225731a77b65addbbd4e9d54a27fb9e9',
    width: 320,
    height: 50,
    src: 'https://bauval.org/22/225731a77b65addbbd4e9d54a27fb9e9',
    label: '320x50 Mobile Banner',
  },
  banner728x90: {
    id: '32379933',
    key: '2be3ac907fcda70bc7f43d9597942fdd',
    width: 728,
    height: 90,
    src: 'https://bauval.org/22/2be3ac907fcda70bc7f43d9597942fdd',
    label: '728x90 Leaderboard Banner',
  },
  banner160x600: {
    id: '32379934',
    key: '4a8cff0c92508da6d2a00ec04953f9c0',
    width: 160,
    height: 600,
    src: 'https://bauval.org/22/4a8cff0c92508da6d2a00ec04953f9c0',
    label: '160x600 Skyscraper Banner',
  },
  banner300x250: {
    id: '32379935',
    key: '9554459908a2bc388043770cd3d4546b',
    width: 300,
    height: 250,
    src: 'https://bauval.org/22/9554459908a2bc388043770cd3d4546b',
    label: '300x250 Medium Rectangle Banner',
  },
} as const satisfies Record<string, BannerSlotConfig>;

export const ADSTERRA_SMARTLINK_URL =
  'https://araplhn.org/4/35de11863c2a37d95915ae394bfe4734';

export const ADSTERRA_NATIVE_CONFIG = {
  id: '32379929',
  containerId: 'container-fdce4d0a04b0efff9a6ced87f123875a',
  src: 'https://bauval.org/21/fdce4d0a04b0efff9a6ced87f123875a',
};

interface AdsterraBannerProps {
  slot: BannerSlotConfig;
  className?: string;
}

export const AdsterraBanner: React.FC<AdsterraBannerProps> = ({
  slot,
  className = '',
}) => {
  const srcDoc = useMemo(() => {
    const safeKey = slot.key;
    const safeSrc = slot.src;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key' : '${safeKey}',
        'format' : 'iframe',
        'height' : ${slot.height},
        'width' : ${slot.width},
        'params' : {}
      };
    </script>
    <script src="${safeSrc}"></script>
  </body>
</html>`;
  }, [slot.key, slot.height, slot.width, slot.src]);

  return (
    <div
      className={`flex flex-col items-center print:hidden ${className}`}
      data-ad-slot={slot.id}
    >
      <span className="text-[10px] tracking-wide text-slate-400 dark:text-slate-500 mb-1 self-start">
        Sponsored
      </span>
      <div
        className="rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/60"
        style={{ width: slot.width, height: slot.height, maxWidth: '100%' }}
      >
        <iframe
          title={slot.label}
          srcDoc={srcDoc}
          width={slot.width}
          height={slot.height}
          scrolling="no"
          frameBorder={0}
          className="block border-0 max-w-full"
        />
      </div>
    </div>
  );
};

export const AdsterraNativeBanner: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const existingScript = document.querySelector(
      `script[data-adsterra-native="${ADSTERRA_NATIVE_CONFIG.id}"]`
    );
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.setAttribute('data-adsterra-native', ADSTERRA_NATIVE_CONFIG.id);
    script.src = ADSTERRA_NATIVE_CONFIG.src;
    host.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <section
      aria-label="Sponsored Recommendations"
      data-ad-slot={ADSTERRA_NATIVE_CONFIG.id}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 print:hidden ${className}`}
    >
      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-2">
        Sponsored Recommendations
      </div>
      <div ref={hostRef} className="min-h-[90px]">
        <div id={ADSTERRA_NATIVE_CONFIG.containerId} />
      </div>
    </section>
  );
};

export const AdsterraSmartlinkCard: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <section
      aria-label="Featured Financial Partner"
      data-ad-slot="32379927"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 print:hidden ${className}`}
    >
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
          Sponsored Partner
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Discover Personal Finance & Savings Deals
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Explore curated financial tools, banking offers, and budgeting resources from our advertising partners.
        </p>
      </div>

      <a
        href={ADSTERRA_SMARTLINK_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors self-start whitespace-nowrap"
      >
        <span>Explore Partner Offers</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </section>
  );
};
