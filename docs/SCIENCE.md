# Plethscape: simulation notes

Plethscape is a visual teaching model. Its waveforms are generated analytically;
they are not downloaded PWDB samples, patient measurements, or a validated
cardiovascular solver. The anatomical reference combines BodyParts3D 4.0 with
Human Reference Atlas lung surfaces; anatomical geometry and physiological
simulation have separate provenance.
PPG represents local optical blood-volume changes, not ECG, arterial pressure,
or volumetric blood flow. See [anatomy sources and adaptations](ANATOMY-SOURCES.md).

## Anatomical reference and interpretation

BodyParts3D provides named anatomical surfaces and spatial relationships. Its
original construction used the TARO male MRI reference with subsequent
segmentation and anatomical illustration refinements, as described by
[Mitsuhashi et al.](https://academic.oup.com/nar/article/37/suppl_1/D782/1000752).
The lung parenchyma is separately sourced from Browne and Schlehlein's
[Human Reference Atlas male lung v1.4](https://doi.org/10.48539/HBM532.KLZD.394),
derived from the NLM Visible Human Male. These are different reference sources
registered for a teaching illustration, not organs from one intact patient.
Removing reproductive structures gives this interface a neutral presentation;
it does not make the underlying adult male reference anatomically sex-neutral
or representative of every body.

The source archive already contains reduced polygon meshes. Display colors,
transparency, tissue shading, luminous flow trails, and motion are presentation choices.
Heart contraction, lung expansion, and walking/running are illustrative
animation. They are not finite-element mechanics, measured organ motion, or a
validated ventilation or gait model. More detailed surfaces do not validate
the PPG generator or calibrate its pulse transit times.
Blood-flow trails illustrate downstream material transport; they are not the
speed of an arterial pressure wave or the local optical blood-volume pulse.
This interface does not claim resolved capillary beds, venous-valve mechanics,
or a cardiac electrical-conduction model.

The [BodyParts3D project notes](https://lifesciencedb.jp/bp3d/info/index.html)
describe incomplete coverage, manually constructed or adjusted parts, and
possible concept-mapping errors. A named mesh supports spatial exploration;
it does not establish a complete anatomical account, patient-specific anatomy,
clinical measurement, or suitability for diagnosis or surgical planning.
In particular, the selected 4.0 archive's nerve/ganglion/spinal-cord leaf meshes
cover cranial and central structures; they do not supply a complete limb
peripheral nerve network. Do not describe this layer as all nerves mapped.

## Cardiovascular routes and display conventions

The user's [Innerbody cardiovascular guide](https://www.innerbody.com/image/cardov.html)
informed the requested scope. Its text was checked against the primary publisher's
[OpenStax heart anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy)
and [circulatory pathways](https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways).
The simplified adult circulation taught here is:

`right atrium → right ventricle → pulmonary trunk/arteries → lung capillaries → pulmonary veins → left atrium → left ventricle → aorta/systemic arteries → tissue capillaries → systemic veins → venae cavae → right atrium`

Arteries conduct blood away from the heart; veins return it. Red and blue encode
relative oxygenation as a teaching convention, not literal vessel or blood
color. Pulmonary arteries therefore appear blue in the artery layer, while
pulmonary veins appear red in the vein layer. Coronary arteries arise from the
aorta. Bronchial arteries supplying lung tissue are systemic arteries and
remain red. The coronary sinus empties **directly into the right atrium**; the
Innerbody page's statement that it drains into a vena cava is not used. These
relationships follow the OpenStax sections linked above.

Tapering luminous trails follow 18 selected arterial source-vessel routes: 17 systemic
arteries and the pulmonary trunk. They provide arterial flow cues; they do not
animate complete venous return. Route direction uses named upstream vessels.
The displayed ribbons have illustrative width, speed and spacing. A separate
subtle vessel glow follows the animated heartbeat; neither effect calibrates
pulse-wave speed or transit time. They do not solve pressure gradients, conservation of mass,
branch flow, or oxygen transport. Source-derived centerlines are geometric
approximations. Ribbon paths receive bounded local smoothing for presentation,
with endpoints preserved; this does not reconstruct or validate vessel lumens. The complete circulation above is an explanatory sequence, not
a claim that the displayed mesh contains every connecting capillary or an
unbroken computational vessel graph. The source inventory has no named meshes
for capillary beds, venous valves, chordae tendineae, conduction nodes, or
pericardium. No such structures or physiological mechanisms should be implied
by the animation. No Innerbody or OpenStax illustrations are included as assets.

## Source basis

- [PWDB Zenodo record 3275625](https://zenodo.org/records/3275625), version
  0.2.0, contains simulated pulse waves and cardiovascular variations across
  virtual subjects. It informs morphology and population-level variation; the
  live beat-to-beat variation added here is an independent teaching layer,
  not measured human variability or coefficients fitted to those records.
- [Charlton et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28296645/) studied
  respiratory signals extracted from ECG and PPG in 57 healthy subjects.
  This supports distinguishing respiratory signal modulation from sensor
  artifacts; it does not calibrate this app's chosen variability amplitudes.
- [Dehkordi et al., 2018](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00948/full)
  describes respiratory-induced frequency, amplitude and baseline variation in
  PPG. Inspiration typically accelerates the heart and can reduce pulse amplitude;
  responses differ between people. This supports the types and direction of the
  coupling used here, not our numerical coefficients or a person-specific prediction.
- [PWDB overview](https://peterhcharlton.github.io/pwdb/pwdb.html): 4,374 virtual
  subjects, six age groups from 25 to 75, several arterial wave types, and public
  domain dataset licensing. The accompanying publication should be credited when
  using its data. This app currently uses no PWDB data files.
- [PWDB data dictionary](https://github.com/peterhcharlton/pwdb/wiki/pwdb_data.mat):
  PPG is in arbitrary units; pressure has separate fields in mmHg. Radial and
  digital sites correspond to wrist and finger. The superior temporal endpoint
  approximates the ear; anterior tibial corresponds to ankle. Forehead and toe
  in this app are illustrative additions. The data also includes onset times
  and physiological plausibility flags.
- [Charlton et al., 2019](https://doi.org/10.1152/ajpheart.00218.2019): the
  116-segment arterial model includes terminal Windkessels. Its PPG approximation
  integrates inflow minus outflow, then normalizes volume variation to 0–1:
  `V(t) = integral(Qin - Qout) dt`. At nonterminal sites,
  `Qout = (P - Pout) / R`, with `R = (mean(P) - Pout) / mean(Qin)`.
  This is not a light-tissue transport model. The authors state that its PPG
  fidelity needs further investigation. Healthy-ageing simulations do not
  establish individual or disease predictions. Several source parameters used
  male data; a visually gender-neutral avatar does not make those references
  population-neutral.
- [Cunningham et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36580284/): a primary
  study of 169,787 participants supports an association between finger PPG notch
  smoothness, age, and vascular factors. Notch presence is variable and should
  not be taught as a deterministic age threshold or a standalone diagnosis.
- [Djurić et al., 2023](https://doi.org/10.3389/fphys.2023.1191272): experimental
  optical recording above the common carotid used a specialized sensor and
  controlled supine recordings. Neck PPG exists in research; this does not make
  an ordinary reflectance trace a direct measurement of deep carotid flow.

## What the controls do

The mean period is `T = 60 / meanHR` seconds. Individual live intervals vary.
One beat combines a gamma-shaped forward
component, a broad runoff component, a delayed Gaussian reflected component,
and a small negative Gaussian notch. Smooth start/end windows keep the stream continuous. These
component choices and every numerical coefficient are artistic engineering
approximations, not equations fitted to the cited studies.

- Age and the independent stiffness slider increase an internal stiffness
  factor. The modeled reflection moves earlier and merges into the downslope;
  the visible notch becomes smaller. The slider permits students to separate
  chronological age from one vascular property.
- Heart rate sets the long-term mean and mildly changes upstroke timing. Shorter cycles
  mostly compress the diastolic tail. The interface selects heart-rate presets
  of 72, 98, and 142 bpm for rest, walk, and run. Each remains independently
  adjustable afterward; the underlying activity parameter alone does not
  change heart rate.
- Breathing rate sets respiratory modulation frequency (`rate / 60` Hz),
  bounded to 6–36 breaths/min. Interface activity presets are 16, 22, and 30
  breaths/min, and the breathing slider remains independently adjustable.
  The stream has respiratory baseline and amplitude modulation, plus a shared
  respiratory sinus arrhythmia (RSA) clock. The model's instantaneous rate rises
  during lung inflation and falls during expiration. Slower breathing strengthens
  RSA; age and exertion attenuate it. These are illustrative tendencies, not a fitted
  autonomic model. Breathing rate leaves the clean single-beat
  morphology unchanged; view the stream to see its effect.
- Site changes relative arrival delay, contour width, reflected amplitude, and
  signal amplitude. Delays are schematic milliseconds from ejection and do not
  include ECG pre-ejection time. Delay decreases as model stiffness increases.
  They are not population reference values or calibrated path measurements.
- Perfusion changes optical pulse amplitude. Noise adds smooth deterministic
  high-frequency components. Small respiratory baseline/amplitude variation is
  always present. None represents a particular device. Wavelength-dependent illustrative changes are described in WAVELENGTHS.md.
- The live stream also has gentle nonperiodic timing variation, correlated
  beat-to-beat amplitude/width changes, slight variation in the reflected
  component and notch, and slow amplitude/baseline drift. Timing perturbations
  are bounded phase offsets, so the selected HR remains the long-term mean.
  The seeded amplitude factor is bounded to ±2.2%, contour width to ±1.2%, and
  reflection/notch scaling to ±4.5%. Respiratory amplitude modulation is ±3.5%
  at ejection, with a weak preceding-interval filling term and ±1.2% slow gain
  drift. These are design bounds, not clinical reference ranges.
  Variation persists with sensor noise at zero. It is seeded and deterministic
  in the shared, propagation-delayed signal clock, so pause/replay, CSV export,
  and site comparison reproduce the same virtual beats without random resets.
  The clean single-beat view and its morphology metrics remain unchanged.
- Walking and running use custom in-place foot trajectories and a 21-joint
  skeleton, with inverse-kinematic legs and 0.7-second activity blends. The
  authored step cadences are 1.8 steps/s for walking and 2.65 steps/s for running;
  these are presentation presets, not personal or clinical reference values.
  The same continuous stride phase drives periodic PPG contact artifacts and
  a separate synthetic accelerometer stream in g, with gravity in its z component.
  Acceleration is an illustrative waveform, not a derivative of measured limb
  motion or a validated biomechanical model. Noise and motion are rendered after
  the clean morphology to distinguish sensor artifacts from pulse physiology.

### One central clock for heart, lungs and PPG

For time `t`, mean rate `H` and respiratory angular frequency `w`, accumulated
cardiac cycles are `C(t) = H*t/60 + A*(1-cos(w*t))/(60*w) + J(t)`.
Instantaneous rate is its analytic derivative, `H + A*sin(w*t) + 60*J'(t)`.
`J` is smooth seeded bounded phase variation. Its boundedness preserves the
long-term mean, while the parameter bounds keep the derivative positive.
Lung expansion is `(1-cos(w*t))/2`; positive respiratory rate modulation
therefore coincides with inflation. The default illustrative RSA amplitude
is about 3.1 bpm before the slower nonperiodic variation is added.

Beat onsets are solved at integer crossings of `C(t)` using Newton iteration.
Each optical site evaluates the same clock after its source-to-site delay.
The live contour uses elapsed seconds within the actual interval, so jitter
does not stretch the entire systolic upstroke. The animated heart uses those
same central onsets. The UI reports a whole-number rate averaged over two
completed central intervals, refreshed once per second, alongside the latest
completed central inter-beat interval. This is display smoothing only; the raw
analytic rate and beat timing remain unchanged. The displayed central interval
is not a clinical HRV measurement or necessarily identical to a peripheral
peak-to-peak interval.

The five-second optical plot retains a fixed amplitude scale and at least
125 samples per second, including on narrow screens. A representative single
beat intentionally omits variability for morphology comparisons; its UI label
distinguishes it from the live stream. CSV retains `heart_rate_bpm` as the mean
setting and adds `instantaneous_hr_bpm`, `previous_ibi_ms`, and
`respiratory_phase` (fraction 0–1), evaluated at each exported `time_s`.

Verification measures generated peak spacing and amplitude across all seven
sites, tests monotonic timing over the supported controls, compares the displayed
rate to the clock's numerical derivative, and checks pause and CSV consistency.
For an illustrative age-32, 72-bpm, 16-breaths/min resting subject with sensor
noise off, a 120-second sample at 125 Hz gave approximately 792–880 ms optical
peak intervals and a 24.5 ms interval standard deviation. Instantaneous central
rate ranged about 67.8–76.4 bpm; mean peak rate was 72.02 bpm. These are software
verification results, not validation against human recordings. A calibrated
digital twin would require individual recordings and model fitting.

`reflectionIndex` is the modeled reflected-component amplitude as a percentage
of the incident component. It is **not** a validated clinical reflection index.
`notchProminence` measures the post-systolic rebound above an actual local
minimum relative to the clean systolic peak. It becomes zero if there is no
visible minimum. Clean beat annotations should likewise be omitted when an
extremum does not exist. `transitMs` is the illustrative delay described above.

Pressure and PPG should always keep different labels and units. The dicrotic
feature in PPG should not be presented as an exact timestamp of aortic valve
closure. Signal morphology also depends on cardiac ejection, vascular tone,
sensor contact, temperature, optical properties, and processing that this
minimal model does not independently reproduce.

## Future data-backed mode

A stronger scientific mode would ship a small, attributed subset of actual
PWDB waves and use its recorded onset times and plausibility flags. Compare
age baselines and selected cardiovascular variations without implying that
an interpolated record is a newly solved physiological state. Real PPG sensor
data would additionally be needed to validate the optical/noise model.

### Displayed wearable concepts

All seven sensing sites now have custom device geometry: finger ring, wrist band, black huggie earring, amber temple capsule, neck patch, bicep band and black great-toe band. The toe band illustrates reflectance rather than a transmission clip; the synthetic timing and waveform model are unchanged. The neck trace remains a model reference, not direct deep-carotid flow sensing. The head hides internal structures and uses procedural iris detail, skin-aligned eyebrows and lip pigment, and shallow illustrative nostril recesses for an approachable teaching presentation; those facial additions are illustrative.

### Navigation and visual emphasis

Pinch/scroll zoom follows the gesture position; two-finger drag or right-drag pans. At rest the arms retain the original source pose with palms forward. Activity bends the elbows and turns palms inward with forearm roll distributed along the elbow-to-wrist axis. The wrist, devices and skin follow this shared rig; the source mesh remains unmodified. The heart, lungs and circulation have stronger color while supporting tissues are translucent context. Lungs expand, the diaphragm descends, and the thoracic skin and ribs expand together on the respiratory clock. This motion is deliberately amplified to be visible in an educational overview; it is not calibrated tidal volume, respiratory mechanics or a lung-function measurement.

### Facial presentation and sensor cues

The added nostril recesses, eyebrows, lip pigment and iris detail are illustrative facial presentation, not additional source anatomy or an airway model. An opaque head depth surface hides far-side wearables; the torso remains translucent. The neck patch and temple sensor are fitted to the loaded skin surface with a small display clearance. Amber wearable halos are discovery cues, not simulated optical propagation, and do not alter PPG values.

### Introductory pulse journey

The optional eight-second journey is explicitly slowed for storytelling. It highlights successive source segments of the ascending aorta, aortic arch, left subclavian, left brachial and left radial artery. Missing source segments are not joined by invented geometry. The highlight represents a schematic pressure-pulse sequence, not a blood parcel moving at that speed, and is not a calibrated propagation model. The wrist PPG remains the existing synthetic tissue-volume signal.


## Single-pulse fiducials

The single-beat view uses the standard **on** (pulse onset/foot), **sp** (systolic peak), **dn** (dicrotic notch), **dp** (diastolic peak), and **off** (pulse offset/next onset) terminology. **u** is the maximum first-derivative upslope, projected onto the original PPG trace; second-derivative a–f labels are not applied to raw PPG peaks. Terminology follows Goda, Charlton and Behar, *pyPPG: a Python toolbox for comprehensive photoplethysmography signal analysis* (2024), https://doi.org/10.1088/1361-6579/ad33a2. Figure 3 illustrates variation in notch visibility; Plethscape does not assign clinical contour classes.

A custom detector measures the generated clean pulse on a fixed 1,025-sample grid. On/off are the known segment boundaries, sp is the early systolic maximum, and u is the steepest central-difference upslope after light smoothing. A dn/dp pair is shown only when there is a resolved local minimum followed by a prominent local maximum; merged shoulders remain unmarked. This is a teaching detector, not the pyPPG algorithm or a validated clinical fiducial extractor. A peripheral optical notch is not a direct measurement of aortic valve closure.

Crest time is on–sp, pulse duration is on–off, amplitude is foot-to-crest in arbitrary units, and width at 50% spans the first rising and last falling half-amplitude crossings (linearly interpolated). Times use the selected mean heart rate because this is a representative pulse; they are separate from the respiratory variability of the live stream. The saved comparison remains a dashed reference; annotations describe the active amber pulse only.


## Rhythm and ectopic-beat teaching examples

The rhythm selector changes the shared ventricular event clock used by the heart animation, delayed optical pulses, live readout, comparisons and CSV export. Choose one example at a time: sinus rhythm, AFib, conducted PACs, PVCs, ventricular bigeminy or ventricular trigeminy. PAC and PVC are types of ectopic beats; bigeminy/trigeminy describe their repeating arrangement. These are illustrative examples, not fitted patient recordings or diagnostic classifiers.

| Example | Evidence-based qualitative pattern | Deliberate simulation choices |
| --- | --- | --- |
| Sinus | Organized rhythm with respiratory variation | Existing respiration-coupled analytic clock retained unchanged |
| AFib | Irregular ventricular intervals, variable optical pulse amplitude | Seeded irregular intervals, bounded and normalized to the selected mean rate; amplitude coupled to the preceding filling interval; no sinus respiratory timing imposed |
| Conducted PAC | Premature beat and altered following interval, sometimes incomplete compensation | One in six beats; early interval 0.60 and next interval 1.05 of the underlying cycle; weaker early pulse |
| PVC | Early weak pulse, often a full compensatory pause and stronger subsequent pulse | One in six; short/long intervals 0.60/1.40; early gain 0.40, recovery gain 1.10 |
| Ventricular bigeminy / trigeminy | Repeating ectopic patterns | PVC every second / third beat using the same short–long pair |
| Weak peripheral pulse | A contraction may produce a pulse too weak for a wearable to count | Optional ventricular premature-pulse gain 0.055; event timing and central heartbeat remain unchanged |

Intervals are normalized so the heart-rate control sets the long-term mean ventricular rate, not the underlying sinus-node rate. In all modes the displayed rate is 120 divided by the total duration of the last two completed central intervals, rounded to whole bpm and refreshed once per second. It is not a detector-estimated optical pulse rate. The raw clock retains instantaneous sinus rate or the last-interval ventricular rate for condition modes; export and animation still use the raw clock. AFib timing uses 4,096 deterministic intervals before repetition; periodic ectopic patterns are intentional. Timing is reproducible for negative history and any sampling order. Normal site-dependent travel delays and contour differences remain active. Breathing still moves the lungs and modulates optical amplitude and baseline; these simplified condition examples do not add sinus RSA to their ventricular timing. Single-beat view remains a clean reference and explicitly directs rhythm study to the 10-second live stream (125 samples/s minimum). Export adds rhythm, pulse_deficit and modeled central beat_kind fields; central beat labels precede site-delayed optical pulses.

Evidence and limitations:

- Van der Velden et al., *The photoplethysmography dictionary* (2021): irregular, short–long and repeating PPG patterns; a regular or irregular pulse alone is not a unique rhythm diagnosis. https://pmc.ncbi.nlm.nih.gov/articles/PMC9707923/
- Tang et al., *PPGSynth* (2020): synthesis of premature groups, including multiple compensation/reset patterns. https://doi.org/10.3389/fmed.2020.597774
- Pflugradt et al., *A Fast Multimodal Ectopic Beat Detection Method Applied for Blood Pressure Estimation Based on Pulse Wave Velocity Measurements in Wearable Sensors* (2017): synchronized ECG/PPG examples and reduced premature-pulse amplitude with a larger subsequent pulse. https://www.mdpi.com/1424-8220/17/1/158
- Han et al., *Premature Atrial and Ventricular Contraction Detection Using Photoplethysmographic Data from a Smartwatch* (2020): ectopy can confound AF detection. https://doi.org/10.3390/s20195683
- Kovoor and Thiagalingam, *Smartwatch-induced cardiology referral due to pulse underdetection with premature ventricular complexes* (2021): peripheral pulse deficit despite ongoing cardiac contractions. https://doi.org/10.1016/j.hrcr.2021.05.015
- Bacevicius et al., *DoubleCheck-AF* (2022): frequent premature beats challenged PPG specificity; ECG improves rhythm confirmation. https://pubmed.ncbi.nlm.nih.gov/35463751/

The numerical timing and gain choices above are our bounded teaching parameters, not measured effect sizes from those studies. PACs need not always be conducted, PVC pauses need not always fully compensate, and not all AF has a fast or irregular ventricular response (for example with pacing). This model does not simulate atrial electrical activity, P waves, QRS complexes, treatment effects or disease severity. Rhythm diagnosis and atrial versus ventricular origin require ECG context. Motion, perfusion and sensor quality also change real PPG and remain independently adjustable here.


## Captured heartbeat, sensor cutaway and multi-site comparison

**Inside the signal** freezes one exact event from the current cardiac clock.
The scrubber covers its duration plus the largest site delay. Replay runs at
0.2×, 0.5× or 1× and loops this window. Fiducial jumps use the captured pulse's
actual duration and selected site's delay, rather than the mean heart period.
Returning to live exploration resumes from the current simulation time.

The site plots isolate that same event with its event-specific gain, width and
reflection. Neighboring pulses, baseline drift and sensor noise are omitted.
**Arrival timing** retains source-to-site delay; **Align pulse feet** subtracts
it from each plot, preserving amplitudes on the same 0–1.7 a.u. scale. In aligned
mode, each cursor denotes time since its own site's onset. These are illustrative
central-event-to-site delays, not ECG-derived pulse arrival times: no
pre-ejection interval is included. The replay window can extend into the next
central contraction while the captured distal pulse finishes.

The procedural tissue cutaway illustrates reflectance sensing with an epidermal
roof, vessels, dermal context and subcutaneous tissue. It does not recreate the
actual geometry of each wearable. Curved luminous paths are slowed explanatory
cues, not tracked photons or a Monte Carlo optical solution. Receiver brightness
uses an arbitrary inverse modulation of the isolated pulse; depth, absorption,
vessel motion, dimensions and light intensity are uncalibrated visual choices.

### Green, red and infrared

The controls label example illumination at 530, 660 and 940 nm. Green illustrates
shallower sampling; red and infrared illustrate deeper sampling, with substantial
real-world overlap. Infrared is invisible and rendered in violet false color for visibility.
The selected wavelength now changes the light illustration, clean pulse contour and motion-artifact sensitivity. These are explicitly illustrative site-dependent coefficients (see [WAVELENGTHS.md](WAVELENGTHS.md)), not a calibrated multispectral transfer function or universal wavelength-to-waveform rule.

- [Lee et al., 2013](https://pubmed.ncbi.nlm.nih.gov/24110039/): a 12-person
  reflection PPG experiment compared 530, 645 and 470 nm during baseline and hand
  waving. Green produced better pulse-rate agreement with ECG in that setup.
  This does not establish an invariant amplitude, notch shape, or superiority
  at every site and acquisition setting.
- [Sirkia et al., 2020, figure 3](https://www.cinc.org/archives/2020/pdf/CinC2020-179.pdf):
  a multi-wavelength fingertip demonstration showed small waveform timing and
  contour differences across 465–880 nm, including later green than infrared
  pulse feet in the illustrated recording. It is evidence that wavelength can
  affect timing, not a population calibration. Their sample wavelengths differ
  from the example wavelengths in this interface.
- [Moço et al., 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5981460/): living-skin
  experiments and multilayer simulations support depth-dependent contributions
  to remote green and red/infrared signals. This is mechanistic evidence;
  remote-camera results do not calibrate a contact wearable's optical response.

Real morphology and amplitude also depend on local vasculature, skin, contact
pressure, source-detector geometry, illumination, electronics and filtering.
This mode does not infer SpO2 or blood pressure. Meaningful future channel
comparisons should use matched multispectral recordings with acquisition metadata.

## Making subtle variation legible

The main waveform is taller and offers 2.5-, 5- and 10-second windows while keeping
its amplitude axis fixed. **See beat-to-beat changes** overlays the last five
completed site-delayed pulses at onset, retaining their individual durations and
amplitudes, with pulse-interval and peak-height ranges. It isolates clean pulses
in the same way as captured playback. This is display magnification and comparison;
physiological variability coefficients were not increased to exaggerate differences.
The representative single-beat view remains static so age and stiffness can be
compared without live variability confounds.


### Lung visibility in the anatomical view

Lung surfaces are opaque and softly shaded in the default atlas view, making the
breathing silhouette readable and naturally occluding internal branches. A smooth
visual mask lowers the opacity of systemic vessels over the outer lung regions,
while keeping the mediastinum, pulmonary circulation and peripheral vessels
untouched. This is presentation emphasis, not removal or reclassification of
anatomy. Existing triangle indices are partitioned into opaque/context draw groups
without altering source vertices or dropping triangles. Disabling the lungs
restores the vessels; Heart detail retains its translucent lung context. Breathing
normals follow the existing lung expansion; displacement and respiratory timing
are unchanged.

The headband has been replaced by a single skin-fitted temple capsule. This presentation change retains the previous head-site waveform parameters and internal `forehead` key; it does not establish a validated temple optical transfer function.
