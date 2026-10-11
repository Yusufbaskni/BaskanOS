# BaskanOS

Baskani Yazılım için **yazılım şirketi ajan işletim sistemi**.

## Özellikler

- 20 rol / ajan odası (Cursor SDK)
- Company Board: kart ekle, sürükle-bırak, sil, pipeline ilerlet
- Ajan çıktıları board’a yazılır; ajanlar arası handoff
- Kritik işlemlerde insan onayı
- Streaming yanıtlar
- Alan bazlı model profili (`fast` / deep)
- Çoklu proje + repo `cwd` (Cursor local ajan)
- Kalıcı durum: `~/Library/Application Support/BaskanOS/state.json`
- İsteğe bağlı PIN (`BASKANOS_PIN`)
- macOS native uygulama (Swift + WKWebView, Electron yok)

## Geliştirme

```bash
cd "/Users/yusufbaskani/Projects/Baskani Yazılım/BaskanOS"
cp .env.example .env   # CURSOR_API_KEY doldur
npm install
npm run dev
```

## Masaüstü

```bash
npm run desktop:swift
```

`/Applications/BaskanOS.app` kurulur ve açılır. Kod değişince yeniden çalıştır.

## Ortam

```env
CURSOR_API_KEY=
BASKANOS_CURSOR_MODEL=composer-2.5
# Alan bazlı (opsiyonel):
# BASKANOS_CURSOR_MODEL_ENGINEERING=composer-2.5
BASKANOS_PIN=            # boşsa kilit yok
BASKANOS_DATA_DIR=       # varsayılan Application Support
BASKANOS_DEFAULT_CWD=    # varsayılan proje repo yolu
```
