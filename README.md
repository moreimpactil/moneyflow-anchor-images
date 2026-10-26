# moneyflow-anchor-images

תמונות "צפי עוגנים" שבועיות שנשלחות לקבוצת יועצי המשכנתאות של Moneyflow. נתוני שוק בלבד.

- `YYYY-MM-DD/` — ארבע תמונות לכל שבוע (לאומי, הפועלים, מזרחי-טפחות, דיסקונט).
- `tools/render.mjs` — מייצר את התמונות מתוצאות `get_bank_anchors`, בעיצוב שנקרא ישירות מקוד המסך ב-Moneyflow.
- `tools/run.sh <data.json> <outDir> <moneyflowRepoDir>` — מתקין גופן ומריץ.
