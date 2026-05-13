---
'@stageflip/pack-news-pro': patch
---

T-509 — News Pro Pack: fills the **RAI register** placeholder landed
in T-506 with a real substantive preset (`rai-pro-register`). Cluster
A `lowerThird` clip; RAI / TG1 blue `#003F88` bar with white `#FFFFFF`
left strip (the inverse register from Sky / BBC / ITV's colored-strip-
on-neutral-bar; distinguishes the Italian-state-broadcaster register
from UK and US broadcasters); Mixed Case headline + Italian-language
role (`Conduttore TG1`); BYO Helvetica Neue (RAI variant) family +
Plus Jakarta Sans OFL fallback matching the primitive's hard-coded
inline `fontFamily`. Manifest's `contributes.presets[2]` updated; all
three register slots are now substantive (Sky News T-507 at [0], ITV
T-508 at [1], RAI T-509 at [2]). Only T-510 news-ticker preset remains
to close out the News Pro pack contributions.
