// isiXhosa translation of the 'String Methods' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const methodsModuleXh = {
  "title": "Ii-method zeString",
  "level": "Ophakathi",
  "prerequisite": "Ukujikeleza kwiistring",
  "outcomes": [
    "Tsalela kwi-methods kunye ne-dot notation uze uchaze indlela eyahlukileyo ngayo kwimisebenzi",
    "Sebenzisa count(), find(), replace(), lower() kunye upper() ngokuchanekileyo",
    "Qikelela ukuveliswa kweefowuni ze-method ezixutywe",
    "Kuphephe ukufumanisa-ngokuchasene nokubala kunye nemigibe yokubala"
  ],
  "learnSections": [
    {
      "title": "Izinto kunye nokutyhilwa kwamanqaku",
      "blocks": [
        {
          "text": "I-Python string nganye i- ** object**, ixabiso elidibanisa idatha (iimpawu) kunye nokuziphatha (i-methods yayo). Imisebenzi ithatha i-string njengeparameter, njenge-`len(s)`; methods ibizwa kwi-string kunye ne-dot, njenge-`s.lower()`."
        },
        null,
        {
          "title": "I-method",
          "text": "Umsebenzi okwi-object kwaye ubizwa nge-dot notation: `object.method(arguments)`. Isebenza ngokuzenzekelayo kwinto eboshwe kuyo."
        },
        {
          "title": "Impazamo eqhelekileyo: ukuxuba iisinti ezimbini",
          "text": "`s.len()` kunye `lower(s)` zombini ziyasilela. Ukuba ilinganisa okanye iguqulela kwenye uhlobo, ngokuqhelekileyo yimisebenzi (`len`, `ord`, `int`); ukuba ivelisa i-string eguqulweyo, ngokuqhelekileyo yi-method."
        }
      ]
    },
    {
      "title": "I-core ezintlanu methods",
      "blocks": [
        {
          "head": [
            "I-method",
            "Ukubuya",
            "Umzekelo"
          ],
          "rows": [
            [
              "s.count(x)",
              "Zingaphi izihlandlo ezingagqitywanga x ezivelayo",
              "\"banana\".count(\"an\") ivelisa 2"
            ],
            [
              "s.find(x)",
              "Index ye-FIRST occurrence, okanye -1",
              "\"banana\".find(\"na\") ivelisa 2"
            ],
            [
              "s.replace(a, b)",
              "I-string entsha ene-a nganye ethatyathelw' indawo yi-b",
              "\"aha\".replace(\"a\", \"o\") ivelisa \"oho\""
            ],
            [
              "s.lower()",
              "Ikopi entsha enobumba obutofotofo",
              "\"MiXed\".lower() ivelisa \"mixed\""
            ],
            [
              "s.upper()",
              "Ikopi entsha eneenkcukacha ezinkulu",
              "\"MiXed\".upper() ivelisa \"MIXED\""
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: fumana vs count",
          "text": "I-`count()` iphendula i-\"how many?\"; i-`find()` iphendula i-\"where is the first one?\". Ukufunda i-`\"banana\".find(\"na\")` njengezihlandlo ezi-2 (kunokuba i-index 2) yindlela ye-MCQ engalunganga."
        },
        {
          "title": "Impazamo eqhelekileyo: ukulindela ukuba ukudibana kubalwa",
          "text": "I-`\"banana\".count(\"ana\")` ngu-1, hayi 2. Emva kokuthelekisa kwi-index 1, ukubalwa kuqhubeka NGEMVA komdlalo, ngoko ke i-\"ana\" eqhotyoshelweyo kwi-index 3 ayizange ibonwe."
        },
        {
          "title": "find() ibuyisa -1 luphawu",
          "text": "Xa ukukhangela string kungekho, `find()` ibuyisa -1 endaweni yokutshatyalaliswa. Iinkqubo zokwenyani (kunye neempendulo zovavanyo) zihlola `if s.find(x) != -1:` ngaphambi kokusebenzisa isikhundla."
        }
      ]
    },
    {
      "title": "Ukudibanisa ii-method",
      "blocks": [
        {
          "text": "Ngenxa yokuba yonke i-method ibuyisa i-string, iifowuni zinokuqhagamshelwa: i-method nganye iqhuba kwisiphumo salowo wangaphambili, ngokuqinileyo ukusuka ekhohlo ukuya ekunene."
        },
        {
          "caption": "Qaphela ukuba i-capital A ayifani ne-minuscript \"aka\", kuba indawo etshintshayo nayo i-case-sensitive."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Umbuzo wenkulumo kunye namaxwebhu amaninzi adlulileyo asebenzisa le fom: indawo elandelwa yindawo ephezulu / engezantsi, kunye nokukhetha okungalunganga okusebenzisa iifowuni ngokulandelelana okungalunganga okanye ukungahoyi umahluko phakathi koonobumba abakhulu nabancinci. Sombulula umnxeba omnye ngexesha, ubhale phantsi i-string nganye ephakathi."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "Methods sebenzisa umqondiso wamabala (`s.upper()`); imisebenzi ithatha string njengeparameter (`len(s)`).",
            "`count()` = zingaphi (ezingaphambaniseki); `find()` = index yokuqala, okanye -1.",
            "`replace()`, `lower()` ne `upper()` zonke zibuyela kwi-strings entsha, kwaye eyokuqala ayitshintshi.",
            "Iifowuni ezidityanisiweyo zisombululwa ukusuka ekhohlo ukuya ekunene: sombulula i-string nganye ephakathi.",
            "Yonke i-method iyathintelwa; qiniseka ukuba i-lower() xa imeko ingeyomfuneko."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukucombulula i-method chain",
      "intro": "Ukufowunelwa ngemixokelelwane nje kukuhamba komjelo, ukujonga umzila omnye ngexesha, ungaze uzenze zombini ngaxeshanye.",
      "steps": [
        {
          "text": "Umnxeba wokuqala: replace(\"aka\", \"oo\"). Khangela i-\"aka\" encinci, kwaye iqala kwi-index 2. I-capital A kwi-index 0 ayikwazi ukuqala umdlalo."
        },
        {
          "text": "La magama mathathu athatyathelw' indawo yi-\"oo\", nto leyo eyenza i-string \"Aloozam\" entsha. \"Alakazam\""
        },
        {
          "text": "Umnxeba wesibini: .upper() iqhutywa kwi-\"Aloozam\" kwaye ibuyisa i-\"ALOOZAM\", eboniswayo."
        }
      ]
    },
    {
      "title": "Kutheni i-count() ingaphuthelwa kukudibana",
      "intro": "Ukukhangela oonobumba abathathu ngaphakathi kwe\"banana\", yaye umphumo uyamothusa phantse wonke umntu kanye.",
      "steps": [
        {
          "text": "Ukuhlolwa kuqala kwi index 0. \"ban\" ayikho \"ana\"; kwi index 1, \"ana\" iyahambelana."
        },
        {
          "text": "Ukubala kuqhubeka NGEMVA komdlalo wonke, kwi-index 4, hayi kwi-index 2. Kwi-index 4 i-\"na\" kuphela eseleyo: imfutshane kakhulu ukuba ilingane."
        },
        {
          "text": "I-\"ana\" eqala kwi-index 3 yayigqitywa, kuba ukubalwa okungekhoyo akuzange kuhlolisise emva."
        }
      ]
    }
  ]
};
