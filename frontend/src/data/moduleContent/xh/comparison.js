// isiXhosa translation of the 'String Comparison' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const comparisonModuleXh = {
  "title": "String Ukuthelekisa",
  "level": "Osaqalayo",
  "outcomes": [
    "Thelekisa strings kunye ==, <, > usebenzisa ulungelelwaniso lwesichazi-magama",
    "Cacisa ukuba kutheni uthelekiso lusengqiqweni, usebenzisa amaxabiso e-ord()",
    "Sebenzisa in operator ukuvavanya substrings",
    "Fumanisa umgibe we-uppercase-pre-lowercase kumbuzo wovavanyo"
  ],
  "learnSections": [
    {
      "title": "Ulungelelwaniso lwesicatshulwa, ileta ileta",
      "blocks": [
        {
          "text": "I-Python ithelekisa i-strings ngendlela isichazi-magama esihluza ngayo amagama: Hamba zombini i-strings kunye, umlinganiswa nomlinganiswa, kwaye umahluko WOKUQALA unquma yonke into."
        },
        null,
        {
          "title": "Ulungelelwaniso lwezichazi-magama",
          "text": "Ukuthelekisa ngenani Unicode leempawu ezihambelanayo, ukusuka ekhohlo ukuya ekunene. Ukuba i-string iphela kuqala kwaye yonke into ihambelana kude kube ngoku, i-string emfutshane incinci."
        },
        {
          "text": "Ngaphantsi kwekhowudi, uthelekiso ngalunye lweempawu luthelekiso lwamaxabiso e-`ord()`. Loo nyaniso inye ichaza zonke iziphumo ze-\"weird\" kule modyuli."
        }
      ]
    },
    {
      "title": "Iimeko zibalulekile kuyo yonke indawo",
      "blocks": [
        {
          "text": "Kwi-Unicode, ZONKE iimpawu ezinkulu (65-90) zihamba phambi ZAZO ZONKE iimpawu ezincinci (97-122). Ngoko ke `\"Cat\"` no-`\"cat\"` ziistring ezahlukeneyo, kwaye nayiphi na impawu encinci \"inkulu kune\" nayiphi na impawu enkulu."
        },
        {
          "head": [
            "Inkcazo",
            "Isiphumo",
            "Kutheni?"
          ],
          "rows": [
            [
              "\"Cat\" == \"cat\"",
              "False",
              "Iimpawu zokuqala ezahlukeneyo: C (67) vs c (99)"
            ],
            [
              "'a' > 'Z'",
              "True",
              "ord(\"a\") is 97; ord(\"Z\") is 90"
            ],
            [
              "\"Zebra\" < \"apple\"",
              "True",
              "Uhlobo lwe-Z enkulu (90) phambi kwe-a encinci (97)"
            ],
            [
              "\"10\" == 10",
              "False",
              "I-string ayikaze ilingane nenani"
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukucinga ukuba 'a' < 'Z'",
          "text": "I-alfabhethi intuition ithi a iza phambi Z, kodwa Unicode ithi ngenye indlela. `'a' > 'Z'` ngu True kuba 97 > 90."
        },
        {
          "title": "Ukuthelekiswa kwamatyala",
          "text": "Ukuze uthelekise ngelixa ungahoyanga ityala, qiniseka ukuba amacala omabini aqhelekile: `a.lower() == b.lower()`. Izisombululo zovavanyo zangaphambili zisebenzisa le nto ukuze zamkele zombini i-\"n\" kunye ne-\"N\" kumsebenzisi."
        }
      ]
    },
    {
      "title": "I-in operator: Uvavanyo lwe-substring",
      "blocks": [
        {
          "text": "I-`x in s` ngu-True xa istring `x` sibonakala ndawo thile ngaphakathi kwe-`s` njengolandelelwano oluqhubekayo lweempawu. Sesona sivavanyo silungileyo se-membership i-Python esinikelayo, kwaye siyakhathala ngoonobumba abakhulu nabancinci."
        },
        null,
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Ngaphambili MCQs list izivakalisi ezininzi `in` uze ubuze ukuba yeyiphi True. iinketho engalunganga phantse rhoqo ziyahluka ukusuka elungileyo kuphela kwimeko ileta enye, ngoko funda zonke oonobumba."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "Strings thelekisa ngokulandelana kwesichazi-magama: uphawu lokuqala olungafaniyo luyagqiba.",
            "Wonke umlinganiso weempawu ngumlinganiso we`ord()` ngezantsi.",
            "Onke oonobumba be-UPPERCASE bahlelwa phambi kwabo bonke oonobumba abancinci, ngoko i-`'a' > 'Z'` yi-True.",
            "I-`==` phakathi kwe-string kunye nenombolo ihlala i-False, nokuba ye-`\"10\"` kunye ne-10.",
            "I-`x in s` ihlolisisa i-substring, kwaye i-case-sensitive njengayo yonke enye into."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukugijima amagama amabini ukuya umahluko wokuqala",
      "intro": "Ukuthelekisa kuyeka xa kuvela ukungalingani kokuqala. Jonga indlela encinane ngayo nganye ye-string enokuhlolwa ngayo.",
      "steps": [
        {
          "text": "Thelekisa index 0 kuwo omabini amagama: `a` vs `a`. Lingana, ngoko qhubeka."
        },
        {
          "text": "Index 1: `p` vs `p`."
        },
        {
          "text": "Index 2: `p` (112) vs `r` (114). eyahlukileyo! ekubeni i-112 < 114, \"apple\" incinci."
        }
      ]
    },
    {
      "title": "Umgibe omkhulu",
      "intro": "Ukuthelekiswa komlinganiswa omnye ukuba abafundi abaninzi baphosakele ekuboneni kokuqala.",
      "steps": [
        {
          "text": "I-instinct ithi: a ngowona mnqophiso wokuqala we-alfabhethi, u-Z ngowona wokugqibela, ngoko ke ngokuqinisekileyo u- < Z?"
        },
        {
          "text": "I-Python ithelekisa amanani e-Unicode: I-ord('a') yi-97 kunye ne-ord('Z') yi-90."
        },
        {
          "text": "97 > 90, ngoko ke ibinzana ngu True. Xa kukho amathandabuzo kumbuzo uthelekiso, tshintshela kumaxabiso ord()."
        }
      ]
    }
  ]
};
