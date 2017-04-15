# Fryslan Uitgebeeld
Dit is de broncode van de oudekaarten-viewer die te vinden is op fryslanuitgebeeld.frl. Dit is alleen het front-end. Het back-end wordt volledig verzorgd door een standaard Geoserver installatie.

## Viewer

### Configuratie
In de Javascript-code in index.html staat een variabele 'viewer' waarin de configuratie genoemd wordt. Deze bestaat uit drie delen:

### Sources
Dit is een lijst van WMS en WFS servers die automatisch uitgelezen worden. Alle kaarten die een van de groepen uit 'groups' matcht, wordt getoond in de lijst met beschikbare kaarten.

### Groups
Dit zijn de groepen waarin de kaarten in de lijst met beschikbare kaarten worden gesorteerd. Iedere groep heeft een 'name' en een 'pattern'. De eerste is de naam die in de kop van de groep wordt getoond, de tweeede een regular expression die matcht met alle identifiers van de kaarten die tot deze groep behoren.

### Properties
Deze lijst werkt ongeveer hetzelfde als de groepen, maar gaat over hoe eigenschappen uit een kaart moeten worden getoond wanneer erop geklikt wordt. Bijvoorbeeld voor de kaartlaag met kaartnummers staat hier gedefinieerd welke naam een eigenschap in het popup-menu moet krijgen en hoe de popup die een punt op de kaart beschrijft eruit ziet.

### Overige kaarten
Kaarten zoals de achtergrondkaarten worden apart toegevoegd via viewer.addLayer. Deze methode accepteert gewone OpenLayers layers en de opmaak van eventuele feature layers doe je hier dan ook op de standaard OpenLayers manier.

## Transparantie
De viewer is zo ingesteld dat wit (#fff, met een klein beetje speling) als transparant wordt gezien. De kaarten in Geoserver zijn ook zo ingesteld dat transparant inderdaad als wit wordt verstuurd. Het wit in de kaarten zelf is nooit #fff wit, daarom gaat dit goed. Dit is gedaan zodat Geoserver wel JPEG ipv PNG kan gebruiken. Aangezien het om foto's van oude kaarten gaat is JPEG een veel geschikter bestandsformaat dan PNG.

## Geoserver
Omdat de Geoserver die is ingericht voor deze website niet zo krachtig is (dat hoeft ook niet, hij hoeft immers niets dynamisch te doen) zijn de kaarten met het volgende scriptje voorbewerkt alvorens ze aan Geoserver zijn toegevoegd.

```
$folder = 'C:\NIEUW_Schotanus_1718'
$out = "$($folder)\output"
$files = Get-ChildItem "$($folder)\*.tif"
ForEach ($file in $files) {
    & "C:\Program Files\GDAL\gdal_translate.exe" -of GTiff -co "TILED=YES" -a_nodata 255 -scale 0 255 -co "NBITS=8" -ot Byte -co "PHOTOMETRIC=RGB" -a_srs EPSG:28992 $file "$($out)\$($file.basename).tif"
    & "C:\Program Files\GDAL\gdaladdo.exe" -ro -r gauss "$($out)\$($file.basename).tif" 2 4 8 16
}
```

In Geoserver zijn de tiles allemaal van tevoren gecached. Dit wordt aangestuurd door seed-cache.html. De viewer vraagt alleen maar tiles op op zo'n manier dat dit voor cache hits zorgt in deze cache.
