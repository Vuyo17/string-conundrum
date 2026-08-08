// isiXhosa translation of the 'String Formatting' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const formattingModuleXh = {
  "title": "Ukufomatha String",
  "level": "Ophakathi",
  "outcomes": [
    "Gcwalisa iitemplate nge .format() usebenzisa amanani ezikhundla",
    "Ukulungelelaniswa kolawulo kunye nobubanzi nge <, > kunye ^",
    "Amanani ajikelezileyo kunye neepads ezineenkcukacha zefomathi ezinje nge-6.2f",
    "Sebenzisa if-strings, uze ubone umgibe ongekhoyo"
  ],
  "learnSections": [
    {
      "title": "Iitemplate kunye nemingxunya yokuma",
      "blocks": [
        {
          "text": "Cinga nge ** template** njengonobumba wefom: isicatshulwa esisigxina sibhaliwe kanye, kunye nemingxunya enamanani apho amaxabiso ethululwa khona. `{0}` ithetha \"the first argument of format()\", `{1}` yesibini, kwaye umngxunya ofanayo ungasetyenziswa ngaphezu kwesihlandlo esinye, nangalo naluphi na ulungelelwaniso."
        },
        {
          "caption": "Inani likhetha ingxoxo; indawo yomngxunya ikhetha indawo ewela kuyo."
        },
        {
          "title": "Ukucaciswa kwefomathi",
          "text": "Imiyalelo eyongezelelweyo emva kwe-colon ngaphakathi komngxunya: `{0:>20}` ithetha \"argument 0, right-aligned in a field 20 wide\"."
        }
      ]
    },
    {
      "title": "Ukulungelelaniswa nobubanzi",
      "blocks": [
        {
          "text": "Ububanzi benza umngxunya ube yintsimi enobungakanani obungagqibekanga, egutyungelwe ngamathuba. Imicibisholo ibonisa apho i-VALUE ihamba khona: `<` iyityhala ngasekhohlo, `>` iyityhala ngasekunene, `^` iyibeka embindini."
        },
        {
          "head": [
            "Inkcazo",
            "Isiphumo",
            "Kutheni?"
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukufunda umcibisholo ngasemva",
          "text": "Umcibisholo ubonisa apho ixabiso lihlala khona, hayi apho i-padding ihamba khona. `>` = ixabiso kwi-right = spaces kwi-LEFT. I-MCQ yangaphambili inikezela zombini ii-paddings njengeendlela."
        }
      ]
    },
    {
      "title": "Amanani okufomatha: ububanzi, ukuchaneka",
      "blocks": [
        {
          "text": "Kwi-floats, i-spec `W.Pf` ithetha: ububanzi bendalo iyonke W, enezibalo ze-P ngqo emva kwenqaku lamashumi, ezijikeleziweyo. Amanani alungelelaniswe ngasekunene ngokuzenzekelayo, ngoko nayiphi na i-padding ihlala ngasekhohlo."
        },
        null,
        {
          "title": "Bala intsimi njengomhloli",
          "text": "Kwi-'  3.14': isicatshulwa 3.14 sinamagama amane, ububanzi buyi-6, ngoko ke 2 izithuba zibeka ngasekhohlo. Ububanzi bubala KONKE: amanani, inqaku elishumi kunye nomqondiso."
        }
      ]
    },
    {
      "title": "f-strings: ukufomatha kwi-inline",
      "blocks": [
        {
          "text": "I- **f-string** ibeka ibinzana ngqo ngaphakathi kwi-braces: `f\"Hi {name}\"`. Iifomathi ezifanayo zisebenza emva kwe-colon: `f\"R{amount:.2f}\"`. Izixhobo zekhosi zanamhlanje kunye nemibuzo yovavanyo zisebenzisa zombini izimbo."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukulibala i prefix f",
          "text": "Ngaphandle kwe-f, i-string ngumbhalo oqhelekileyo kwaye i-`{name}` iprinta ngokuchanekileyo njengoko ithayiphe. Akukho mpazamo, akukho zitshintsho, yiyo kanye le nto yenza umbuzo olungileyo wokuvavanya."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "`{0}`, `{1}` khetha format() iingxabano ngesikhundla; umngxunya unokuphindaphinda.",
            "`<`, `>`, `^` lungisa ixabiso ekhohlo, ekunene okanye embindini ngaphakathi kububanzi obunikelweyo.",
            "I-`W.Pf` inika i-float P i-decimals ejikeleziweyo ngaphakathi kwendawo enobubanzi be-W; amanani alungelelaniswe ngasekunene ngokuzenzekelayo.",
            "f-strings ukuvavanya izivakalisi kwi braces: `f\"R{amount:.2f}\"`.",
            "Ngaphandle kwe-f prefix, i-braces ziimpawu nje, ngoko i-`{name}` iprinta ngokoqobo."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukufunda umngxuma okwizikhundla",
      "intro": "Umngxunya omnye, iingxabano ezimbini, umlinganiso ophakathi: inxalenye nganye yolwimi lwefomathi kumgca omnye.",
      "steps": [
        {
          "text": "I-1 phambi kwe-colon ikhetha i-argument number 1, ukubala ukusuka kwi-zero, oko kukuthi i-\"BB\". I-\"AA\" ayikaze isetyenziswe."
        },
        {
          "text": "I-spec ^4 igxininisa ixabiso kwintsimi eneempawu ezi-4 ububanzi. \"BB\" ngu 2 ububanzi, eshiya izithuba ezi-2 ezabelwana ngazo."
        },
        {
          "text": "Isithuba esinye sifika kwicala ngalinye: intsimi eprintiweyo yindawo, B, B, indawo."
        }
      ]
    },
    {
      "title": "Ububanzi kunye nokuchaneka kwi-float",
      "intro": "I-spec 6.2f, iqhotyoshelwe inombolo ngamanani.",
      "steps": [
        {
          "text": "Inxalenye ye .2f: gcina amanani amabini emva kwenombolo yeshumi, ujikeleze, ukuze i-3.14159 ibe yi-3.14."
        },
        {
          "text": "I-6 bububanzi obupheleleyo. I-\"3.14\" ithatha oonobumba abane (inqaku libalwa), ngoko kufuneka oonobumba aba-2 be-padding."
        },
        {
          "text": "Amanani alungelelaniswa ngasekunene ngokuzenzekelayo, ngoko zombini iindawo zokugcwalisa zihamba ngasekhohlo."
        }
      ]
    }
  ]
};
