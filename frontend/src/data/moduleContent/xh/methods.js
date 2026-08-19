// isiXhosa translation of the 'String Methods' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const methodsModuleXh = {
  "title": "String Methods",
  "level": "Ophakathi",
  "outcomes": [
    "Biza i-methods nge-dot notation kwaye uchaze indlela eyahlukileyo ngayo kwimisebenzi",
    "Sebenzisa count(), find(), replace(), lower() kunye upper() ngokuchanekileyo",
    "Qikelela ukuphuma kweefowuni ze-method ezidityaniswe",
    "Ziphephe iimbophelelo zokubala ngokuchasene nokufumana"
  ],
  "learnSections": [
    {
      "title": "Izinto kunye nokuboniswa kwamanqaku",
      "blocks": [
        {
          "text": "Yonke i-Python string yinto ****, ixabiso elidibanisa idatha (iimpawu) kunye nokuziphatha (i-methods yayo). Imisebenzi ithatha i-string njengeparameter, njenge-`len(s)`; i-methods ibizwa kwi-string kunye ne-dot, njenge-`s.lower()`."
        },
        null,
        {
          "title": "Method",
          "text": "Umsebenzi obhekisela kwinto kwaye ubizwa nge-dot notation: `object.method(arguments)`. Isebenza ngokuzenzekelayo kwinto enamathele kuyo."
        },
        {
          "title": "Impazamo edla ngokwenzeka: ukuxuba ezi zinto zimbini",
          "text": "I-`s.len()` kunye ne-`lower(s)` zombini ziyasilela. Ukuba iyalinganisa okanye iguqulele kolunye uhlobo, idla ngokuba yimisebenzi (`len`, `ord`, `int`); ukuba ivelisa i-string eguqulweyo, idla ngokuba yi-method."
        }
      ]
    },
    {
      "title": "I-nucleus ezintlanu methods",
      "blocks": [
        {
          "head": [
            "Method",
            "Imbuyekezo",
            "Umzekelo"
          ],
          "rows": [
            [
              "s.count(x)",
              "Zingaphi izihlandlo ezingasongeliyo x ezivelayo",
              "\"banana\".count(\"an\") is 2"
            ],
            [
              "s.find(x)",
              "Index yesiganeko sokuqala, okanye -1",
              "\"banana\".find(\"na\") is 2"
            ],
            [
              "s.replace(a, b)",
              "I-string entsha ene-a nganye ethatyathelw' indawo yi-b",
              "\"aha\".replace(\"a\", \"o\") is \"oho\""
            ],
            [
              "s.lower()",
              "Ikopi entsha enobuncinane",
              "\"MiXed\".lower() is \"mixed\""
            ],
            [
              "s.upper()",
              "Ikopi entsha enobumba obukhulu",
              "\"MiXed\".upper() is \"MIXED\""
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: fumana vs count",
          "text": "I-`count()` iphendula i-\"how many?\"; i-`find()` iphendula i-\"where is the first one?\". Ukufunda i-`\"banana\".find(\"na\")` njengezihlandlo ezi-2 (esikhundleni se-index 2) kukhetho olungafanelekanga lwe-MCQ."
        },
        {
          "title": "Impazamo eqhelekileyo: ukulindela ukuba ukudibanisa kubalwa",
          "text": "I-`\"banana\".count(\"ana\")` ngu-1, hayi 2. Emva kokuthelekiswa kwi-index 1, ukubalwa kuqhubeka NGEMVA komdlalo, ngoko i-\"ana\" engqinelanayo kwi-index 3 ayizange ibonwe."
        },
        {
          "title": "I-find() ibuyisa i-1 yinkalo",
          "text": "Xa ukukhangela i-string kungekho, i-`find()` ibuyisela i-1 endaweni yokutshatyalaliswa. Iinkqubo zokwenyani (kunye neempendulo zovavanyo) zihlola i-`if s.find(x) != -1:` ngaphambi kokusebenzisa isikhundla."
        }
      ]
    },
    {
      "title": "Ukudibanisa methods",
      "blocks": [
        {
          "text": "Ngenxa yokuba yonke i-method ibuyisela i-string, iminxeba inokuqokelelwa: i-method nganye iqhuba kwisiphumo salowo wangaphambili, ngokuqinileyo ukusuka ekhohlo ukuya ekunene."
        },
        {
          "caption": "Qaphela ukuba i-capital A ayihambelani ne-minuscript \"aka\", kuba indawo etshintshayo iyathintelwa."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Uvavanyo lwethiyori kunye namaphepha amaninzi edlulileyo asebenzisa lo mfuziselo kanye: i-replace elandelwa yi-upper/lower, ngokhetho oluphosakeleyo olusebenzisa iinguqulelo ngokulandelelana okungachanekanga okanye olungakhathaliyo ngoonobumba abakhulu nabancinci. Sombulula uhlelo olunye ngexesha, ubhale phantsi istring ngasinye esiphakathi."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "I-Methods isebenzisa i-dot notation (`s.upper()`); imisebenzi ithatha i-string njengeparameter (`len(s)`).",
            "`count()` = zingaphi (ezingagqitywanga); `find()` = index yokuqala, okanye -1.",
            "I-`replace()`, i-`lower()` ne-`upper()` zonke zibuyela kwi-strings entsha, kwaye eyokuqala ayitshintshi.",
            "Iifowuni ezidityanisiweyo zisombulula ukusuka ekhohlo ukuya ekunene: phumeza nganye phakathi string.",
            "Yonke i-method iyathandeka kwimeko; qiniseka nge-lower() xa imeko ingenamsebenzi."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukucombulula umxokelelwane we-method",
      "intro": "Iifowuni eziqhutywa ngemixokelelwane ziyinkqubo nje, ziqwalasele ikhonkco elinye ngexesha, ungaze uziqwalasele zombini ngaxeshanye.",
      "steps": [
        {
          "text": "Umnxeba wokuqala: replace(\"aka\", \"oo\"). Khangela oonobumba abancinci \"aka\", kwaye iqala kwi index 2. I-capital A kwi index 0 ayikwazi ukuqala umdlalo."
        },
        null,
        {
          "text": "Umnxeba wesibini: .upper() iqhutywa kwi-\"Aloozam\" kwaye ibuyisa i-\"ALOOZAM\", eprinta ukubonisa."
        }
      ]
    },
    {
      "title": "Isizathu sokuba i-count() ilahlekelwe kukudibanisa",
      "intro": "Ukukhangela oonobumba abathathu ngaphakathi kwe\"banana\", yaye umphumo uyamothusa phantse wonke umntu kanye.",
      "steps": [
        {
          "text": "Uhlalutyo luqala kwi index 0. \"ban\" ayiyiyo \"ana\"; kwi index 1, \"ana\" iyahambelana."
        },
        {
          "text": "Ukubala kuqhubeka NGEMVA komdlalo wonke, kwi-index 4, hayi kwi-index 2. Kwi-index 4 i-\"na\" kuphela eseleyo: imfutshane kakhulu ukuba ihambelane."
        },
        {
          "text": "Isixa esipheleleyo: 1. I-\"ana\" eqala kwi-index 3 yayigqitywa, kuba ukubalwa okungalinganiyo akunakubukela umva."
        }
      ]
    }
  ]
};
