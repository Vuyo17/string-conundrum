// isiXhosa translation of the 'String Comparison' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const comparisonModuleXh = {
  "title": "Ukuthelekisa iiString",
  "level": "Osaqalayo",
  "prerequisite": "Ukunga-tshintshwa kweeString",
  "outcomes": [
    "Thelekisa i-strings kunye ne- ==, <, > usebenzisa umyalelo wesicatshulwa",
    "Chaza isizathu sokuba uthelekiso lube luncedo kwiimeko, usebenzisa amaxabiso e-ord()",
    "Sebenzisa in operator ukuvavanya ukuba kukho i-substrings",
    "Ukufumanisa umgibe we-cap-pre-minorcase kwimibuzo yohlolo"
  ],
  "learnSections": [
    {
      "title": "Ulungelelwaniso lwegama, ileta ileta",
      "blocks": [
        {
          "text": "I-Python ithelekisa i-strings ngendlela isichazi-magama esihluza ngayo amagama: hamba zombini i-strings kunye, umlinganiswa nomlinganiswa, kwaye umahluko WOKUQALA unquma yonke into."
        },
        null,
        {
          "title": "Ulungelelwaniso lwe-lexicographic",
          "text": "Ukuthelekisa ngenani lamaXUnicode oonobumba abahambelanayo, ukusuka ekhohlo ukuya ekunene. Ukuba enye iXstring iphela kuqala kwaye yonke into ihambelana kude kube ngoku, iXstring emfutshane incinci."
        },
        {
          "text": "Ngaphantsi kwe-hood, uthelekiso ngalunye lweempawu luthelekiso lwamaxabiso e-`ord()`. \"weird\""
        }
      ]
    },
    {
      "title": "Iimeko zibalulekile kuyo yonke indawo",
      "blocks": [
        {
          "text": "KwiUnicode, ZONKE oonobumba abakhulu (65-90) ziza phambi kwazo ZONKE oonobumba abancinci (97-122). Ngoko i`\"Cat\"` ne`\"cat\"` ziyahlula istrings, kwaye nayiphi na ileta encinci yi\"greater than\" nayiphi na i-cap."
        },
        {
          "head": [
            "Ukuvakaliswa",
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
              "ord(\"a\") ivelisa 97; ord(\"Z\") ivelisa 90"
            ],
            [
              "\"Zebra\" < \"apple\"",
              "True",
              "I-Z enkulu (90) i-sorts phambi kwe-minor a (97)"
            ],
            [
              "\"10\" == 10",
              "False",
              "A string ivelisa never equal to a number"
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukucinga ukuba i-'a' < 'Z'",
          "text": "I-Alfabhethi intuition ithi a iza phambi Z, kodwa Unicode ithi ngenye indlela. `'a' > 'Z'` ngu True kuba 97 > 90."
        },
        {
          "title": "Ukuthelekisa okungenabubele",
          "text": "Ukuthelekisa ngelixa ungayinanzi imeko, qiniseka ukuba amacala omabini aqhelekile: `a.lower() == b.lower()`. Izisombululo zokuvavanya zangaphambili zisebenzisa oku ngokuchanekileyo ukwamkela zombini i-\"n\" kunye ne-\"N\" kumsebenzisi."
        }
      ]
    },
    {
      "title": "Umqhubi: Uvavanyo lwe-substring",
      "blocks": [
        {
          "text": "I-`x in s` yi-True xa i-string `x` ibonakala kwindawo ethile ngaphakathi kwe-`s` njengoluhlu oluthe ngqo lweempawu. Python"
        },
        null,
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "I-MCQs ye-list idlule kwiimpawu ezininzi ze-`in` kwaye ibuze ukuba yeyiphi i-True."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "Strings thelekisa ngokulandelana kwesichazi-magama: uphawu lokuqala olwahlukileyo luyagqiba.",
            "Xa uthelekisa oonobumba, kukho i`ord()`.",
            "Onke amagama e-UPPERCASE ahlelwe phambi kwawo onke amagama amancinci, ngoko ke i-`'a' > 'Z'` yi-True.",
            "I-`==` phakathi kwe-string kunye nenombolo ihlala i-False, nokuba ye-`\"10\"` kunye ne-10.",
            "I-`x in s` ihlolisisa isiseko, kwaye i-case-sensitive njengento yonke."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukugijima amagama amabini ukuya umahluko wokuqala",
      "intro": "Xa uthelekisa, uya kujonga ukuba istring nganye ihlolwe kancinane kangakanani.",
      "steps": [
        {
          "text": "Thelekisa index 0 kuwo omabini amagama: `a` vs `a`. Lingana, ngoko qhubeka."
        },
        {
          "text": "Index 1: `p` vs `p`."
        },
        {
          "text": "Index 2: `p` (112) vs `r` (114). eyahlukileyo! ekubeni i-112 < 114, i-\"apple\" incinci."
        }
      ]
    },
    {
      "title": "Umgibe omkhulu",
      "intro": "Ukuthelekisa umlinganiswa omnye okubangela ukuba abafundi abaninzi benze impazamo xa beqala ukuyibona.",
      "steps": [
        {
          "text": "I-instinct ithi: a ngowona mnqophiso wokuqala we-alfabhethi, u-Z ngowona wokugqibela, ngoko ke ngokuqinisekileyo u- < Z?"
        },
        {
          "text": "I-Python ithelekisa amanani e-Unicode: I-ord('a') yi-97 ne-ord('Z') yi-90. Zonke oonobumba abancinci bahlala kumda ophezulu kunayo yonke oonobumba abakhulu."
        },
        {
          "text": "97 > 90, ngoko ke ibinzana ngu True. Xa kukho amathandabuzo kumbuzo uthelekiso, guqula kwi ord() amaxabiso."
        }
      ]
    }
  ]
};
