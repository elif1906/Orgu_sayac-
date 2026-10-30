# 🧶 Örgü Sayacı

Örgü ve tığ işi için basit, telefona kurulabilen sıra ve ilmek sayacı.

## Özellikler

- Birden fazla proje, her biri için sıra sayacı ve ilerleme çubuğu
- Büyük + butonu ve dokunuşta titreşim
- Her yeni sırada sıfırlanan ilmek sayacı
- "Her N sırada bir" hatırlatma ve hedef sıra sayısı
- Proje notları
- Sayaç açıkken ekran kararmaz
- İnternetsiz çalışır, veriler sadece cihazda saklanır
- Açık / koyu tema

Web sürümü: https://orgu-sayaci.vercel.app

## Proje yapısı

- `www/`: uygulamanın kendisi (HTML, CSS, JS). Hem web sürümü hem Android uygulaması bunu kullanır.
- `android/`: Capacitor ile oluşturulan Android projesi
- `assets/`: Android ikonu ve açılış ekranı için kaynak görsel

## Web sürümünü yerelde çalıştırma

```bash
python3 -m http.server 5173 --directory www
```

Ardından tarayıcıda `http://localhost:5173` adresini aç.

## Android uygulaması

Gerekenler: [Android Studio](https://developer.android.com/studio) ve Node.js.

```bash
npm install
npm run sync      # www/ içindeki değişiklikleri Android projesine kopyalar
npm run android   # projeyi Android Studio'da açar
```

Android Studio'da ▶ (Run) butonuyla uygulamayı telefonda ya da emülatörde çalıştır.
