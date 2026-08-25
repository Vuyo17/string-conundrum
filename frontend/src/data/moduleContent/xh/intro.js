// isiXhosa translation of the 'Introduction to Strings' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const introModuleXh = {
  "title": "Intshayelelo kwiiString",
  "level": "Osaqalayo",
  "outcomes": [
    "Yenza i-string i-literals kunye ne-quotes enye okanye kabini",
    "Sebenzisa escape sequences njenge \\ n kunye \\\\ ngokuchanekileyo",
    "Guqula phakathi kweempawu kunye neenombolo ze-Unicode nge-ord() kunye ne-chr()",
    "Joyina, phinda uze ulinganise strings nge +, * kunye len()"
  ],
  "learnSections": [
    {
      "title": "Yintoni ngokwenene istring",
      "blocks": [
        {
          "text": "I-string** lulandelelaniso lweempawu: oonobumba, amanani, izithuba kunye neempawu, ngokulandelelana okuqinileyo."
        },
        {
          "caption": "I-quotes enye kunye ne-quotes ephindwe kabini yenza uhlobo olufanayo lwe-string."
        },
        {
          "title": "String ngokoqobo",
          "text": "Umbhalo obhalwe ngqo ngekhowudi, upakishwe ngokuhambelana ne-quotes enye okanye kabini. Ngaphandle kwe-quotes, i-Python icinga ukuba umbhalo ligama le-variable."
        },
        {
          "title": "Quotes ngaphakathi quotes",
          "text": "I-string efana ne-`it's cold` iphula i-quotes yodwa, kuba i-Python icabanga ukuba i-string iphela kwi-apostrophe. `\"it's cold\"`"
        }
      ]
    },
    {
      "title": "Escape sequences: oonobumba abafihlakeleyo",
      "blocks": [
        {
          "text": "Ezinye iimpawu azinakubhalwa ngqo ngaphakathi kwestring. I **escape sequence** iqala ngebackslash kwaye imele uphawu olunye: `\\n` ngumgca omtsha kwaye `\\\\` yi-backslash enye."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukubala iescape sequences njengeempawu ezimbini",
          "text": "Iimvavanyo zithanda ukubuza i-`len()` ye-string equkethe i-`\\n`. Kwikhowudi yomthombo ijongeka ngathi ziimpawu ezimbini, kodwa i-string igcina uphawu olunye olutsha. `len(\"Cape\\nTown\")` ngu-9."
        }
      ]
    },
    {
      "title": "Ngaphantsi kwe-hood: Unicode, ord() kunye chr()",
      "blocks": [
        {
          "text": "Ikhompyutha ayizigcini iileta; igcina amanani. **Unicode** ngumaphu ovunyiweyo phakathi kwenani kunye neempawu: 65 yi-`A`, 66 yi-`B`, kwaye 97 yi-`a`. Imisebenzi emibini ihamba phakathi kwehlabathi ezimbini."
        },
        {
          "head": [
            "Ukuvakaliswa",
            "Isiphumo",
            "Kutheni?"
          ],
          "rows": [
            [
              "ord(\"A\")",
              "65",
              "Umlinganiswa ukuya kwinombolo Unicode"
            ],
            [
              "chr(97)",
              "'a'",
              "Unicode inombolo ukuya kumlinganiswa"
            ],
            [
              "chr(ord(\"a\") + 2)",
              "'c'",
              "Iimpawu zinokutshintshwa ngokusebenzisa i-arithmetic"
            ],
            [
              "ord(\"a\") - ord(\"A\")",
              "32",
              "Iileta ezincinane zihlala kwiindawo ezingama-32 emva kwezikhulu"
            ]
          ]
        },
        {
          "text": "Kungenxa yoko le nto i-arithmetic yeempawu isebenza: ukuhambisa oonobumba ngokongeza kwixabiso labo le-`ord()` yindlela kanye yokucombulula izivivinyo zeklasi ye-cypher kule khosi."
        },
        {
          "title": "Amanani abonakala ngathi ngumyalezo",
          "text": "`int(\"1234\")` iguqula inani string libe yinani elipheleleyo; `str(1234)` iya kwelinye icala. de uguqule, `\"10\"` yimigca emibini kuphela, kwaye ayifani nombolo `10`."
        }
      ]
    },
    {
      "title": "Ukwakha kunye nokulinganisa: +, * kunye len()",
      "blocks": [
        null,
        {
          "title": "Impazamo eqhelekileyo: ukulindela * ukwenza izibalo kwi-digit strings",
          "text": "I-`'23.4' * 2` yi-`'23.423.4'`, hayi i-46.8. I-quotes yenza ukuba ibe yi-string, kwaye * iphinda i-strings, kwaye ayize idibanise amanani abo."
        },
        {
          "title": "Impazamo eqhelekileyo: + phakathi kwestring kunye nenombolo",
          "text": "`\"Score: \" + 10` iphakamisa i TypeError. Guqula kuqala: `\"Score: \" + str(10)`."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "Strings ziintambo ezihlelwe ngemibala, ezihlanganiswe ngokuhambelana quotes.",
            "I-escape sequence efana ne-`\\n` okanye i-`\\\\` ngumlinganiswa omnye, hayi ezimbini.",
            "I-`ord()` iguqula inombolo ibe yinombolo yayo ye-Unicode; i-`chr()` iguqula inombolo ibe yinombolo kwakhona.",
            "I-`+` ijoyina i-strings, i-`*` iyaziphinda, kwaye i-`len()` ibala abalinganiswa bazo.",
            "I-string yamanani ihlala i-string: `\"10\" != 10` de uguqule nge-`int()`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukubala oonobumba ngeescape sequence",
      "intro": "Umzekelo, eyona nto ithandwayo kwitheyibhile: Mide kangakanani istring equkethe iescape sequence?",
      "steps": [
        {
          "text": "Kwi-source code, i-literal ibonakala ngathi ziimpawu ezine: A, backslash, n, B."
        },
        {
          "text": "Kodwa i-Python iguqulela i-`\\n` ibe ngumlinganiswa omnye womgca omtsha njengoko ifunda ikhowudi. string"
        },
        {
          "text": "I-`len(s)` ibala oonobumba abagciniweyo, ngoko iprinta i-3."
        }
      ]
    },
    {
      "title": "Ukuhambisa ileta ngeord() kunye nechr()",
      "intro": "Ipateni ye-cypher: hambisa uphawu phambili ngokusebenzisa i-alfabhethi usebenzisa inombolo yalo ye-Unicode.",
      "steps": [
        {
          "text": "I-`ord(\"c\")` ikhangela inombolo ye-Unicode ye-`c`, eyi-99."
        },
        {
          "text": "Ukongeza 1 kuvelisa 100, nje nje inani eliqhelekileyo."
        },
        {
          "text": "`chr(100)` iguqulwa ibuyele kumlinganiswa: `d`."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umhloli weempawu",
    "description": "Zonke iimpawu kwi string zihleli kwindawo enamanani. Faka i string kunye ne index ukubona indlela i Python efikelela ngayo kumlinganiswa ngamnye, kwaye imodyuli elandelayo igubungela oku nzulu."
  }
};
