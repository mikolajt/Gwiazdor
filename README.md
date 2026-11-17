# 🎁 Gwiazdor

Prosta strona do losowania prezentów (Secret Santa). Organizator wpisuje osoby, ich listy życzeń i budżet, losuje pary i dostaje prywatny link dla każdej osoby. Po otwarciu linku pojawia się prezent — wystarczy go stuknąć, żeby zobaczyć, komu robi się prezent.

- Bez kont, bez serwera, bez instalowania czegokolwiek — same pliki HTML i JavaScript.
- Wylosowane pary **nie są nigdzie zapisywane w repozytorium**. Każdy link sam niesie zakodowaną informację tylko dla swojej osoby, więc repozytorium może być publiczne.

## Publikacja na GitHub Pages

1. Utwórz **publiczne** repozytorium na GitHubie (puste — bez README i licencji).
2. Wypchnij do niego ten projekt (gałąź `main`).
3. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, wybierz `main` i folder `/ (root)`, zapisz.
4. Po chwili strona będzie dostępna pod adresem `https://<twoja-nazwa>.github.io/<nazwa-repozytorium>/`.

Nazwa repozytorium pojawi się w każdym linku, więc warto wybrać coś sympatycznego, np. `gwiazdor`.

## Jak losować

1. Otwórz panel: `https://<twoja-nazwa>.github.io/<nazwa-repozytorium>/admin.html`.
2. Wpisz budżet i dodaj uczestników (imię + opcjonalna lista życzeń). Potrzeba co najmniej 3 osób o różnych imionach.
3. Kliknij **Losuj**.
4. Przy każdej osobie kliknij **Kopiuj link** i wyślij go **tylko tej osobie** (Messenger, SMS, e-mail…).

Imiona są zawsze pokazywane dokładnie tak, jak je wpiszesz.

### Zmiany po wysłaniu linków

- **Zmiana listy życzeń lub budżetu** — pary zostają te same. Przy osobach, których link się zmienił, pojawi się „zmieniony — wyślij ponownie”. Skopiuj i wyślij tylko te linki.
- **Dodanie, usunięcie lub zmiana imienia osoby** — trzeba wylosować od nowa i wysłać wszystkim nowe linki.
- **Losuj ponownie** — wszyscy dostają nowe osoby, więc trzeba wysłać wszystkie linki od nowa.

### Gdzie są zapisane dane?

Tylko w Twojej przeglądarce (na tym komputerze). Panel jest publicznie dostępny, ale każdy, kto go otworzy, zobaczy pusty formularz.
Żeby przenieść dane na inny komputer albo zrobić kopię zapasową, użyj **Eksportuj** / **Importuj**.

### Uczciwość

Panel pokazuje wszystkie wylosowane pary — organizator po prostu obiecuje nie podglądać. 🙂
Linki są zakodowane tak, żeby imienia nie dało się odczytać z adresu na pierwszy rzut oka, ale to nie jest prawdziwe szyfrowanie.

## Dla programistów

- `index.html` — strona z prezentem (dane z części adresu po `#`).
- `admin.html`, `admin.js` — panel organizatora.
- `common.js` — kodowanie linków, losowanie, walidacja, stan panelu.
- `tests.html` — testy; otwórz w przeglądarce albo uruchom `bash run-tests.sh` (Microsoft Edge w trybie headless).
