# ECG teaching catalog — 2026-10-07

34 requested topics (original numbering retained); 33 added catalog entries and the existing AF example. Available in `media-lab.html` after the existing learning access check. It is topic-based study, not a blinded diagnostic exam: names and source annotations can reveal the answer. Only the selected asset loads.

## Provenance and limits

- Source descriptions and image contents were checked; independent clinical adjudication by a MedQadam instructor is still pending.
- Four original programmatic schematics (5, 28, 38, 44) illustrate timing or ST distribution. They are visibly labelled **not patient recordings**, not AI-generated ECG images. Their shape is simplified and cannot establish a diagnosis.
- Imported topics 1, 7, 13 are teaching illustrations. Topic 42 is an author's mirrored teaching figure. Other imported images follow their authors' labels; source links, attribution, licenses and transformations appear under each example.
- Topic 41 deliberately reuses the anterolateral record from 39. It teaches lateral lead involvement, not isolated lateral STEMI. Topic 11 is **supraventricular** trigeminy. Topic 9 is a couplet, not a measurement of daily ectopic burden.
- Topics 50–52 render original PTB-XL 100 Hz samples in 12 simultaneous 10-second strips, with no smoothing or resampling. Not all records are isolated abnormalities. Original waveform/header hashes and source labels are stored alongside them. Display zoom changes physical scale; time/amplitude scales are stated inside the SVG.
- A 2:1 AV pattern cannot alone distinguish Mobitz I/II. ST depression alone does not diagnose NSTEMI; ECG alone neither confirms nor excludes PE. These limits are in each relevant debrief.
- This is a separate ECG library, not a recording of any fictional patient from a consultation.
- No restricted/noncommercial/no-derivatives source images are bundled. Reference pages are linked for reading, not reproduced. Each imported asset retains its own license, including applicable share-alike terms; original MedQadam schematic SVGs are CC BY 4.0.

## Sources

PTB-XL: Wagner, P., Strodthoff, N., Bousseljot, R., Samek, W., & Schaeffter, T. (2022). *PTB-XL, a large publicly available electrocardiography dataset*, v1.0.3. PhysioNet. https://doi.org/10.13026/kfzx-aw45. CC BY 4.0.
Original paper: Wagner et al. (2020), Scientific Data, https://doi.org/10.1038/s41597-020-0495-6.
PhysioNet: Pollard et al. (2026), https://doi.org/10.1038/s44360-026-00096-z.

Commons provenance is retained in the numbered JSON files (source file page, creator, license and downloaded derivative). Dataset provenance is in `ptbxl-*.json`; final file hashes are in `catalog.json`. The existing AF example is documented in `../manifest.json`.

## Topic coverage

| No. | Topic | Material | Source |
|---|---|---|---|
| 1 | Нормальный синусовый ритм | Учебная схема / иллюстрация | [CC0](https://commons.wikimedia.org/wiki/File:Normal_Sinus_Rhythm_(6_seconds).svg) |
| 2 | Синусовая тахикардия | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:ECG_Sinus_Tachycardia_132_bpm.jpg) |
| 3 | Синусовая брадикардия | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:ECG_Sinus_Bradycardia_49_bpm.jpg) |
| 4 | Синусовая аритмия | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:ECG_Sinus_Arrhythmia_79_bpm.jpg) |
| 5 | Синусовая пауза / остановка синусового узла | Учебная схема · не запись пациента | [CC BY 4.0](https://github.com/Nurlybay/disease/blob/main/tools/build-ecg-schematics.py) |
| 6 | Синоатриальная блокада | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Type_II_S-A_block.png) |
| 7 | Предсердная экстрасистолия | Учебная схема / иллюстрация | [Public domain](https://commons.wikimedia.org/wiki/File:PAC.png) |
| 8 | Желудочковая экстрасистолия (PVC) | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:PVC10.JPG) |
| 9 | Частая / парная желудочковая экстрасистолия | ЭКГ из открытого источника | [CC BY 3.0](https://commons.wikimedia.org/wiki/File:Ekg_es_vescouplet_bionerd.jpg) |
| 10 | Бигеминия | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Bigeminy.jpg) |
| 11 | Тригеминия | ЭКГ из открытого источника | [CC BY 4.0](https://commons.wikimedia.org/wiki/File:Supraventricular_trigeminy,_ECG.jpg) |
| 13 | Трепетание предсердий (AFL) | Учебная схема / иллюстрация | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Atrial_Flutter_Unlabeled.jpg) |
| 24 | AV-блокада I степени | ЭКГ из открытого источника | [CC0](https://commons.wikimedia.org/wiki/File:FirstAVBlockAll.jpg) |
| 25 | AV-блокада II степени Mobitz I (Wenckebach) | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Type_I_A-V_block_5-to-4_Wenckebach_periods.png) |
| 26 | AV-блокада II степени Mobitz II | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:2ndDegreeType2.jpg) |
| 27 | AV-блокада 2:1 | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:2to1block.jpg) |
| 28 | Высокоградусная AV-блокада | Учебная схема · не запись пациента | [CC BY 4.0](https://github.com/Nurlybay/disease/blob/main/tools/build-ecg-schematics.py) |
| 29 | AV-блокада III степени / полная поперечная блокада | ЭКГ из открытого источника | [CC BY 3.0](https://commons.wikimedia.org/wiki/File:3rd_degree_heart_block.PNG) |
| 30 | Блокада правой ножки пучка Гиса (RBBB) | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Right_Bundle_branch_block.jpg) |
| 31 | Блокада левой ножки пучка Гиса (LBBB) | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Left_bundle_branch_block.jpg) |
| 37 | Передний STEMI | ЭКГ из открытого источника | [Public domain](https://commons.wikimedia.org/wiki/File:12_Lead_EKG_ST_Elevation_tracing_only.jpg) |
| 38 | Переднеперегородочный STEMI | Учебная схема · не запись пациента | [CC BY 4.0](https://github.com/Nurlybay/disease/blob/main/tools/build-ecg-schematics.py) |
| 39 | Переднебоковой STEMI | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:AnteriorLateralMI.jpg) |
| 40 | Нижний STEMI | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:ECG_001.jpg) |
| 41 | Боковой STEMI | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:AnteriorLateralMI.jpg) |
| 42 | Задний инфаркт миокарда | Зеркальная учебная иллюстрация | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Flipped_Posterior_STEMI_ECG.png) |
| 43 | Инфаркт правого желудочка | ЭКГ из открытого источника | [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Inferior_and_RtV_MI_with_PVC_15_lead.jpg) |
| 44 | NSTEMI / субэндокардиальная ишемия | Учебная схема · не запись пациента | [CC BY 4.0](https://github.com/Nurlybay/disease/blob/main/tools/build-ecg-schematics.py) |
| 49 | Гипертрофия левого желудочка (LVH) | ЭКГ из открытого источника | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Left_Ventricular_Hypertrophy_Unlabeled.jpg) |
| 50 | Гипертрофия правого желудочка (RVH) | 12 отведений · реальный сигнал · 10 с | [CC BY 4.0](https://physionet.org/content/ptb-xl/1.0.3/) |
| 51 | Увеличение левого предсердия | 12 отведений · реальный сигнал · 10 с | [CC BY 4.0](https://physionet.org/content/ptb-xl/1.0.3/) |
| 52 | Увеличение правого предсердия | 12 отведений · реальный сигнал · 10 с | [CC BY 4.0](https://physionet.org/content/ptb-xl/1.0.3/) |
| 64 | ЭКГ-признаки острой ТЭЛА | ЭКГ из открытого источника | [CC BY 2.0](https://commons.wikimedia.org/wiki/File:Pulmonary_embolism_ECG.jpg) |
| 12 | Фибрилляция предсердий | Existing ECGpedia record | [CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Afib_ecg_(CardioNetworks_ECGpedia).jpg) |

## Rebuild and validation

From the repository root:

```sh
python3 tools/build-ecg-schematics.py
python3 tools/render-ptbxl-ecg.py 02417 50
python3 tools/render-ptbxl-ecg.py 06685 51
python3 tools/render-ptbxl-ecg.py 08177 52
python3 tools/build-ecg-catalog.py
python3 tools/build-learning-content.py
node tools/test-ecg-catalog.js
node tools/test-practice.js
# Requires Playwright and a Chromium installation:
node tools/test-ecg-browser.js
```

Publishing requires both the public assets/HTML on Pages and the rebuilt protected `learning-content` function. The access gate is unchanged.
