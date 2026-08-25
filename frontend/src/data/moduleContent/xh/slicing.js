// isiXhosa translation of the 'String Slicing' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const slicingModuleXh = {
  "title": "Ukusika iString",
  "level": "Osaqalayo",
  "prerequisite": "Ukufikelela nge-Index kwiString",
  "outcomes": [
    "Ukukhupha nayiphi na intambo engezantsi nge s[start:stop:step]",
    "Qikelela iimpazamo xa uqalisa, uyeka okanye unyathela",
    "Funda kwaye ubhale i-slices e-inverse usebenzisa inyathelo elibi",
    "Phendula imibuzo yohlolo lwe\"which slice produces X\" ngokuzithemba"
  ],
  "learnSections": [
    {
      "title": "Ukusika isiqwenga kwi-string",
      "blocks": [
        {
          "text": "Indexing ifundeka uphawu olunye; **slicing** ifundeka umqolo opheleleyo. Cinga ngestring njengesiqwenga sesonka esinqumlayo NGAPHakathi kweslice: `start` ithi apho ingena khona imela, `stop` ithi apho iphuma khona, kwaye isicwangciso slice ngokwayo sihlala ebhodini."
        },
        {
          "caption": "\"Hello World\"[2:5] iqokelela amanqaku 2, 3, 4, kwaye iyeka NGAPHAMBI kwe index 5."
        },
        null,
        {
          "title": "I-slice",
          "text": "`s[start:stop:step]` ibuyisa i-string ENTSHA equka oonobumba abavela kwi-`start`, egqibe phambi kwe-`stop`, ihambisa izikhundla ze-`step` ngexesha."
        },
        {
          "title": "Impazamo eqhelekileyo: ukujonga ukuyeka njengento equka",
          "text": "Inani emva komgca we-colon yi-index yokuqala AKUKHO. `s[0:5]` ineempawu ezi-5 kanye (5 - 0), ayisoze ibe zi-6. Uhlolo olulula: ubude be-slice elula yi-stop ususa i-start."
        }
      ]
    },
    {
      "title": "Iimfuneko ezizenzekelayo: zithetha ntoni izithuba ezingenanto",
      "blocks": [
        {
          "text": "Naliphi na la macandelo mathathu linokungabikho, kwaye iimviwo zivavanya oku kanye. Nge ** isinyathelo esihle **: isiqalo esingasekhoyo sichaza u- 0, isithuba esingasekhoyo sichaza isiphelo, kwaye isinyathelo esingasekhoyo sichaza u-1."
        },
        null,
        {
          "text": "Xa kukho isinyathelo ** negative**, iziphumo ezizenzekelayo zijika: isiqalo esingasekhoyo sithetha uphawu LOKUGQIBELA, kwaye isilumkiso esingasekhoyo sithetha \"just past the first character\". Kungenxa yoko le nto i-`s[::-1]` ibuyisa i-string."
        },
        {
          "caption": "Zombini ezi ndlela ziye zabuzwa, phantse igama negama, kwiimviwo ezidlulileyo."
        }
      ]
    },
    {
      "title": "Ukuhamba ngasemva: amanyathelo angalunganga",
      "blocks": [
        {
          "text": "Isinyathelo esibi siqhuba i-string ukusuka ngasemva ukuya phambili. Ukuhamba kuqala kwi-`start`, kugxuma kwizikhundla ze-`step` ngalo lonke ixesha, kwaye kuyeka xa kufikelela kwi-`stop`, ekufuneka ibe NGAPHAMBI kokuqala, okanye akukho nto iqokelelwe."
        },
        {
          "caption": "\"Jabberwocky\"[::-2] ivakashela ii-indices 10, 8, 6, 4, 2, 0 kwaye ivelisa i-'ycwebJ'."
        },
        {
          "head": [
            "Ukuvakaliswa",
            "Isiphumo",
            "Kutheni?"
          ],
          "rows": [
            [
              "\"Jabberwocky\"[::2]",
              "'Jbewcy'",
              "Ukuqhubela phambili, umlinganiswa ngamnye wesibini ukusuka kwiindex 0"
            ],
            [
              "\"Jabberwocky\"[::-2]",
              "'ycwebJ'",
              "Ukubuyela umva ukusuka kumlinganiswa wokugqibela"
            ],
            [
              "\"Jabberwocky\"[5:0:-2]",
              "'rba'",
              "Indices 5, 3, 1, and stop 0 ivelisa excluded"
            ],
            [
              "\"Jabberwocky\"[:5:-1]",
              "'ykcow'",
              "Ukusuka ekupheleni, ukubuyela (ngaphandle) index 5"
            ],
            [
              "\"hello\"[3:1]",
              "'' (ayinanto)",
              "Stop ivelisa behind start with a forward step: nothing collected"
            ]
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukulindela iIndexError",
          "text": "I-Slicing ayize iphakamisa i-IndexError. Imida engaphandle komda ivalwe kwaye ukuhamba okungenakwenzeka kubuyisa i-string engenanto. I-indexing enobumba omnye kuphela enenkani."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Iiphethini ezimbini zixhaphakile kumaxwebhu angaphambili: \"what is the value of `(expr)[a:b:-1]`\" no \"which slice of `w` produces this string\"."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "`s[start:stop:step]`: ukuqala kubalwa, ukuyeka akubandakanyi.",
            "Iimpawu ezizenzekelayo zenyathelo elilungileyo: ukuqala 0, ukuyeka ukuphela, inyathelo 1. `s[:]` ikopa yonke i-string.",
            "Icala elizenzekelayo leNegative-step: Qala kumlinganiswa wokugqibela, ume nje emva komlinganiso wokuqala. `s[::-1]` iyajika.",
            "I-Slicing ayize iphinde iphakamise i-IndexError, kwaye i-slices engenakwenzeka inika i-string engenanto.",
            "Ukulahla oonobumba bokuqala nabokugqibela: `s[1:-1]`. Ukuvavanya i-palindrome: `s == s[::-1]`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukuxela kwangaphambili i-slice",
      "intro": "Eyona ndlela ixhaphakileyo yokuvavanya: iconcatenation, emva koko islice yokwenqaba.",
      "steps": [
        {
          "text": "Qala uxazulule ibinzana: 'Ma'*2 yi 'MaMa', ngoko ke s yi 'GoMaMa', nto leyo enamacala amathandathu, amanqaku 0 ukuya ku-5 (okanye -6 ukuya ku -1)."
        },
        {
          "text": "I-slice iqala kwi -1: uphawu lokugqibela, `a` kwi-index 5."
        },
        {
          "text": "Inyathelo -1 lihamba kwindawo enye ngasekhohlo rhoqo: index -2 yi `M`, index -3 yi `a`."
        },
        {
          "text": "Ukuhamba okulandelayo kuya kuba -4, kodwa -4 yindawo yokumisa, kwaye indawo yokumisa ihlala ingafakwanga. Uhambo luphela ngo 'aMa'."
        }
      ]
    },
    {
      "title": "I-reverse engineering i-slice",
      "intro": "\"Which slice of w produces X?\" Yilungise ngokubhala ii-indices phantsi kweempawu ezijoliswe kuzo.",
      "steps": [
        {
          "text": "Fumana umlinganiswa ngamnye ekujoliswe kuwo w kwaye uqaphele index: `o` yayo 4, `t` kwi 2, `P` kwi 0."
        },
        {
          "text": "Iinkcukacha ziwela ngama-2 ngamaxesha onke, ngoko inyathelo li -2. Ukuhamba kuqala kwi-4, nto leyo i-index -2 ukusuka ngasemva."
        },
        {
          "text": "Emva ko-0 ukuhamba kufuneka kuhambe ngaphambili, ngoko ushiye isithuba esingenanto: `w[-2::-2]` ivelisa 'otP'. Lumka: `w[::-2]` iqala kumlinganiswa wokugqibela kwaye inika 'nhy' endaweni yoko."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umatshini we-Slice",
    "description": "Faka nayiphi na i-string uze usete ii-dials ezintathu, kwaye ushiye nayiphi na kuzo ingenanto ukuze usebenzise i-Python's ezingasebenziyo. Cinezela Ukujonga ukuze ubukele ukuhamba kuqokelela oonobumba omnye nge-hop ngexesha."
  }
};
