# Четыре пациента: исходники и задания для Hailuo

Портреты созданы встроенным imagegen, персонажи полностью вымышленные.
Это исходные кадры для image-to-video, не видеозаписи реальных больных.
В тренажёре они уже работают как портреты; генерация видео не нужна для запуска случая.

Загрузите соответствующий PNG из этого набора. Для каждого достаточно одного
6–8-секундного клипа ожидания. Сохраните соотношение сторон исходника 3:2,
не кадрируйте руки и лицо. Предпочтительно 1080p, MP4 H.264, без звука.
Реплики озвучиваются отдельно: артикуляцию «говорящего человека» не добавлять.
Камера неподвижная; движения умеренные, начало и конец в близкой позе.

## 1. copd-tulegenov.png → copd-tulegenov-idle.mp4

Use the attached still as the exact identity and composition reference. A fictional
63-year-old man sits in a clinic, alert and comfortable enough to remain seated.
Subtle natural blinking, small shoulder and upper chest breathing movements,
a slightly longer gentle exhalation through loosely pursed lips. Hands stay on
his thighs. No dramatic gasping, no blue skin, no collapse. Fixed camera,
unchanged face, clothing and room. No talking, no audio, no text. 6–8 seconds,
seamless gentle loop, end in the starting posture.

## 2. chronic-bronchitis-bekova.png → chronic-bronchitis-bekova-idle.mp4

Preserve the exact face, burgundy cardigan, hands, tissue and room from the
reference. A fictional 46-year-old woman sits calmly, naturally blinks and
slightly adjusts the folded tissue in her hand. Quiet ordinary breathing,
no breathlessness. Fixed camera, no talking, no lip sync, no sound, no text.
6–8 second natural loop, no identity changes or extra fingers.

Дополнительный необязательный клип `chronic-bronchitis-bekova-cough.mp4`:
та же женщина один раз прикрывает рот салфеткой, негромко кашляет и возвращает
руку в исходную позу. Без звука, без видимой мокроты/крови. Не делать многократный
или удушающий кашель. Сам по себе кашель на видео не подтверждает диагноз.

## 3. acs-serikbayev.png → acs-serikbayev-idle.mp4

Preserve the reference identity, blue shirt, hand on the central chest, and clinic.
A fictional 58-year-old conscious man has persistent chest discomfort. Maintain
his tense concerned expression and hand position; subtle breathing and blinking,
a very small brow movement. No smile, no recovery during the clip, no collapse,
no dramatic clutching, no new medical equipment. Fixed camera, no speaking or
sound, no text, 6–8 seconds, return gently to initial posture.

## 4. myocarditis-omarova.png → myocarditis-omarova-idle.mp4

Preserve the exact identity, ponytail, sage green top and clinic composition.
A fictional 29-year-old woman sits upright, looking tired but fully alert. Natural
blinking and subtle chest breathing, a small attentive head movement, hands
remain relaxed on thighs. No fainting, no severe respiratory distress, no smile
of recovery, no visible supernatural heartbeat effects. Fixed camera, no talking,
no audio or text. 6–8 seconds, gently return to initial pose for a loop.

## Проверка готовых клипов

Проверьте лицо, количество пальцев, положение рук, неизменность одежды и фона.
Видео должно соответствовать заданному состоянию и не добавлять новые симптомы.
Не используйте сгенерированные звуки лёгких, сердца, ЭКГ или изображения горла
как достоверный материал для диагностики. Все пять MP4 подключены к соответствующим случаям. В `site/media/patients/video/`
находятся облегчённые версии H.264 без звуковой дорожки. Четыре idle-клипа
зациклены; кашель Гульнары запускается командой «покашляйте» в осмотре
и затем возвращается к idle. Кнопка движения позволяет остановить видео.
