// isiXhosa translation of the 'String Formatting' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const formattingModuleXh = {
  "title": "Ukulungisa iiString",
  "level": "Ophakathi",
  "prerequisite": "Ii-method zeString",
  "outcomes": [
    "Gcwalisa iitemplate nge .format() usebenzisa amanani ezikhundla",
    "Ukuhambelana nokulawula kunye nobubanzi nge <, > kunye ^",
    "Amanani ajikelezileyo kunye neepads ezinemigangatho yefomathi efana ne-6.2f",
    "Sebenzisa if-strings, uze ubone umgibe ongekhoyo"
  ],
  "learnSections": [
    {
      "title": "Iitemplate kunye neembobo zendawo",
      "blocks": [
        {
          "text": "Cinga nge ** template** njengonobumba wefom: itekisi eqinileyo ibhalwe kanye, kunye nemingxunya enamanani apho amaxabiso athululwa khona. `{0}` ithetha \"the first argument of format()\", `{1}` yesibini, kwaye umgxunya ofanayo ungasetyenziswa ngaphezulu kwesinye, nangayiphi na indlela."
        },
        {
          "caption": "Inani likhetha ingxoxo; indawo yomngxunya ikhetha indawo ewela kuyo."
        },
        {
          "title": "Inkcazo yefomathi",
          "text": "Imiyalelo eyongezelelweyo emva komgca ngaphakathi komngxuma: `{0:>20}` ithetha \"argument 0, right-aligned in a field 20 wide\"."
        }
      ]
    },
    {
      "title": "Ukuhambelana nobubanzi",
      "blocks": [
        {
          "text": "Ububanzi benza umngxuma ube yintsimi enobukhulu obuqingqiweyo, egcwele iindawo. Imicibisholo ibonisa apho i-VALUE ihamba khona: `<` iyityhala ekhohlo, `>` iyityhala ekunene, `^` iyibeka embindini."
        },
        {
          "head": [
            "Ukuvakaliswa",
            "Isiphumo",
            "Kutheni?"
          ],
          "rows": [
            [
              "\"{0:<6}\".format(\"one\")",
              "'one   '",
              "Ukuhambelana ngasekhohlo: ixabiso kuqala, 3 izithuba emva"
            ],
            [
              "\"{0:>6}\".format(\"one\")",
              "'   one'",
              "Ukuhambelana ngasekunene: 3 iindawo kuqala"
            ],
            [
              "\"{0:^6}\".format(\"one\")",
              "' one  '",
              "Ephakathi: indawo eyongezelelweyo iya ngasekunene"
            ],
            [
              "\"{1:^4}\".format(\"AA\", \"BB\")",
              "' BB '",
              "Argument 1 ivelisa \"BB\", centred in width 4"
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukufunda umcibisholo umva",
          "text": "Umcibisholo ubonisa apho ixabiso lihlala khona, hayi apho i-padding ihamba khona. `>` = ixabiso kwi-right = spaces kwi-Left. I-MCQ yangaphambili inikezela zombini iipadding njengokukhetha."
        }
      ]
    },
    {
      "title": "Amanani okufomatha: ububanzi. ukuchaneka",
      "blocks": [
        {
          "text": "Kwiiflethi, isicatshulwa `W.Pf` sithetha: ububanzi bebala lilonke W, kunye namadijithi P emva kwenqaku lesishumi, AKAZINGELWE. Amanani alungelelaniswe ngasekunene ngokuzenzekelayo, ngoko nayiphi na i-padding ihlala ngasekhohlo."
        },
        null,
        {
          "title": "Bala intsimi njengomhloli",
          "text": "Kwi-'  3.14': umbhalo 3.14 unamagama amane, ububanzi buyi-6, ngoko ke 2 izithuba zibhengeze ngasekhohlo. Ububanzi bubala NONKE: amanani, inqaku lesishumi kunye nomqondiso."
        }
      ]
    },
    {
      "title": "f-strings: ukufomatha kwi-inline",
      "blocks": [
        {
          "text": "I-f-string** ibeka ibinzana ngqo ngaphakathi kweebhakethi: `f\"Hi {name}\"`. Iifomathi ezifanayo zisebenza emva kwe-colon: `f\"R{amount:.2f}\"`. Izinto zenkambo zanamhlanje kunye nemibuzo yovavanyo isebenzisa zombini izimbo."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukulibala isalathiso f",
          "text": "Ngaphandle kwe-f, i-string yincwadi nje eqhelekileyo kwaye i-`{name}` iphrinta kanye njengoko ithayiphe. Akukho mpazamo, akukho zitshintsho, nto leyo kanye eyenza umbuzo olungileyo wokuvavanya."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "`{0}`, `{1}` khetha format() iingxoxo ngokwemeko; umngxunya unokuphinda.",
            "`<`, `>`, `^` zilungise ixabiso ekhohlo, ekunene okanye embindini ngaphakathi ububanzi obunikelweyo.",
            "`W.Pf` inika i-float P izishumi ezijikeleziweyo ngaphakathi kwentsimi ebanzi i-W; amanani alungelelaniswe ngasekunene ngokuzenzekelayo.",
            "f-strings ukuvavanya amagama kwiibheringi: `f\"R{amount:.2f}\"`.",
            "Ngaphandle kwe-f prefix, i-braces ziimpawu nje, ngoko i-`{name}` iprinta ngokoqobo."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukufunda umngxuma okwizikhundla",
      "intro": "Umngxunya omnye, iingxoxo ezimbini, umlinganiso ophakathi: zonke iinxalenye zolwimi lwefomathi kumgca omnye.",
      "steps": [
        {
          "text": "I-1 phambi kwe colon ikhetha i-argument number 1, ukubala ukusuka kwi-zero, oko kukuthi \"BB\". \"AA\" ayisoloko isetyenziswa."
        },
        {
          "text": "I-spec ^4 igxininisa ixabiso kwibala elinemigca emi-4 ububanzi. \"BB\" ngu 2 ububanzi, eshiya izithuba ezi-2 ukuba zabelane."
        },
        {
          "text": "Indawo enye ifikelela kwicala ngalinye: intsimi eprintiweyo yindawo, B, B, indawo."
        }
      ]
    },
    {
      "title": "Ububanzi kunye nokuchaneka kwi-float",
      "intro": "I-6.2f spec, icodiwe inombolo nganye.",
      "steps": [
        {
          "text": "Inxalenye .2f: gcina amanani amabini emva kwenqaku lesishumi, uzungeze, ngoko 3.14159 iba ngu 3.14."
        },
        {
          "text": "I-6 bububanzi be-TTOTAL. I-\"3.14\" ithatha oonobumba abane (iiphuzu zibalwa), ngoko kufuneka oonobumba aba-2 be-padding."
        },
        {
          "text": "Amanani alungelelaniswa ngasekunene ngokuzenzekelayo, ngoko zombini iindawo zokugcwalisa zihamba ngasekhohlo."
        }
      ]
    }
  ]
};
