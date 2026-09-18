# Wavelength teaching model

Previously the waveform was wavelength-neutral; Green 530 nm only controlled the tissue illustration. Green 530 nm is now the default waveform baseline; Red 660 nm and Infrared 940 nm modify the same site model. All three are schematic, not fitted recordings.

## Evidence
- Maeda et al., 2011, 11 participants, jumping and arm swinging: green PPG pulse intervals correlated better with ECG than infrared across studied sites. https://pubmed.ncbi.nlm.nih.gov/20703691/
- Zhang et al., 2019, wrist motion-artifact reduction uses infrared as a motion reference for green. https://pmc.ncbi.nlm.nih.gov/articles/PMC6387309/
- Sirkiä et al., CinC 2020: multi-wavelength fingertip recordings show small contour/timing differences and describe wavelength-dependent sampling depth. The demonstration used 515/640/880 nm, not this UI's exact LEDs. https://www.cinc.org/archives/2020/pdf/CinC2020-179.pdf
- Depth-dependent sensor experiment used 530/660/940 nm (plus blue). https://pubmed.ncbi.nlm.nih.gov/31835543/

## Deliberate assumptions
The illustrative red and infrared profiles have an earlier, narrower systolic peak, a more separated secondary peak, a stronger/wider notch and lower gain than the green baseline. Differences are deliberately visible at rest and vary with the existing site tissue factor. Age and stiffness still reduce notch prominence. These directions, numerical coefficients and extrapolations to seven sites are illustrative choices, not established universal wavelength signatures. No change to central heart rate, respiratory timing or arterial transit delay is inferred from wavelength.

Activity uses the existing shared gait clock and site-specific swing, impact and contact loss. Red and infrared increase baseline displacement, coupling loss and irregular high-frequency disturbance. Infrared is strongest in this scenario; red is an illustrative intermediate, not a validated ranking. Green can also be severely corrupted. Real outcomes depend on sensor geometry, contact, skin, wavelength, LED power and signal processing.

Relative penetration bars and 3D light paths represent overlapping sampling volumes, not millimeters, distinct vascular layers, or direct carotid measurement. Longer penetration does not mean better signal. No SpO2 calculation, clinical accuracy or device performance prediction is implied.

Single beat and captured pulse show clean morphology; live stream includes noise. Saved references retain their wavelength. Coefficients are deterministic for reproducible comparisons. Presentation sex does not change optics or physiology.

## Skin tone

Melanin is not modelled. The wavelength coefficients are the same for every subject and there is no skin-tone control. Saying so is not the same as saying skin tone does not matter.

What the literature documents is an effect on SpO2 accuracy, not on waveform shape. Pulse oximeters read differently across skin tones because the calibration maps a red/infrared ratio to saturation.

- Bickler et al., Anesthesiology 2005, controlled desaturation in 11 subjects: darker pigmentation reduced pulse oximeter accuracy at low saturation. https://pubmed.ncbi.nlm.nih.gov/15791098/
- Sjoding et al., NEJM 2020, retrospective clinical data: occult hypoxemia was about three times more frequent in Black than in White patients. https://pubmed.ncbi.nlm.nih.gov/33326721/
- Al-Halawani et al., 2023, review of skin pigmentation and pulse oximeter accuracy. https://pmc.ncbi.nlm.nih.gov/articles/PMC10391744/

This interface generates contour and infers no SpO2, so those results do not transfer to it directly. None of the reviewed literature shows melanin shifting the notch or the systolic peak timing. Amplitude and perfusion-dependent attenuation are the plausible targets for a future skin-tone axis, and such an axis should state which of them it models rather than inherit the SpO2 result.

### Datasets that record skin tone

Three openly documented PPG datasets carry a skin-tone label.

- PPG-DaLiA, contact wrist and chest, 15 subjects, Fitzpatrick skin type per subject, open download. https://archive.ics.uci.edu/dataset/495/ppg+dalia
- Aurora-BP, contact wrist, Fitzpatrick class for 823 of 1,125 subjects, heavily skewed to classes 1-3, data use agreement required. https://github.com/microsoft/aurorabp-sample-data
- MMPD, camera-based remote PPG, 33 subjects, `skin_color` on the Fitzpatrick scale, academic use only. https://github.com/THU-CS-PI/MMPD_rPPG_dataset

WESAD, TROIKA, BUT PPG, the Jarchi and Casson wrist set, MIMIC-III and MIMIC-IV waveforms, VitalDB, CapnoBase, Vortal, BIDMC, PPG-BP, DREAMT, UBFC-rPPG, PURE and UBFC-Phys record no such field. WESAD's per-subject readme holds age, height, weight, sex and handedness. DREAMT's data dictionary lists age, sex, BMI, apnea indices and sleep history, and the only skin field in it is skin temperature. UBFC-Phys records sex, assigned scenario, date and start time per subject. TROIKA's paper describes its cohort in prose rather than recording a per-subject label. PPG-DaLiA is the only fully open contact dataset available to check amplitude or signal quality against Fitzpatrick class on real recordings.
