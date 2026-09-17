#!/bin/bash

cd /home/runner/workspace

echo "🔄 AkılCEP GitHub otomatik senkronizasyon başladı..."
echo "⏱️ Değişiklikler yaklaşık 60 saniyede bir kontrol edilecek."

while true; do
    if [ -n "$(git status --porcelain)" ]; then
        echo "📦 Değişiklik bulundu..."

        git add -A

        git commit -m "Auto sync: AkılCEP updates $(date '+%Y-%m-%d %H:%M:%S')" || true

        if git push origin main; then
            echo "✅ GitHub güncellendi."
        else
            echo "⚠️ GitHub push başarısız. Otomatik sistem devam ediyor."
        fi
    fi

    sleep 60
done
