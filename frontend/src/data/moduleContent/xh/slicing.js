// isiXhosa translation of the 'String Slicing' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const slicingModuleXh = {
  "title": "String Slicing",
  "level": "Osaqalayo",
  "outcomes": [
    "Ukukhupha nayiphi na intambo engezantsi nge-s[start:stop:step]",
    "Qikelela iimpazamo xa uqalisa, uyeka okanye unyathela",
    "Funda kwaye ubhale i-slices ibuyele umva usebenzisa inyathelo elibi",
    "Phendula imibuzo yohlolisiso lwe\"which slice produces X\" ngokuzithemba"
  ],
  "learnSections": [
    {
      "title": "Ukusika isiqwenga kwi-string",
      "blocks": [
        {
          "text": "I-Indexing ifundeka uphawu olunye; **slicing** ifundeka umqolo opheleleyo wazo. Cinga nge-string njengesiqwenga sesonka esinesiqwenga NGAPHAMBI kwe-slice nganye: `start` ithi apho ingena khona imela, `stop` ithi apho iphuma khona, kwaye i-stop slice ngokwayo ihlala ebhodini."
        },
        {
          "caption": "I-\"Hello World\"[2:5] iqokelela ii-indices 2, 3, 4, kwaye iyama NGAPHAMBI kwe-index 5."
        },
        null,
        {
          "title": "Slice",
          "text": "I-`s[start:stop:step]` ibuyisela i-string ENTSHA equkethe oonobumba abavela kwi-`start`, iphela ngaphambi kwe-`stop`, ihambisa izikhundla ze-`step` ngexesha."
        },
        {
          "title": "Iphutha eliqhelekileyo: ukujonga ukuyeka njengokubandakanywa"
        }
      ]
    },
    {
      "title": "Iimpawu ezizenzekelayo: zithetha ntoni izithuba ezingenanto",
      "blocks": [
        {
          "text": "Nayiphi na kwezi nxalenye zintathu inokushiywa ngaphandle, kwaye iimviwo zivavanya oku kanye. Ngenyathelo **elungileyo**: isiqalo esingasekhoyo sichaza u-0, ukuyeka okungasekhoyo kuchaza isiphelo, kwaye isinyathelo esingasekhoyo sichaza u-1."
        },
        null,
        {
          "text": "Ngenyathelo **elibi**, okuzenzekelayo kuyaguquka: isiqalo esingasekhoyo sithetha umlinganiswa wokugqibela, kwaye ukuyeka okungasekhoyo kuthetha \"kanye emva komlinganiswa wokuqala\". Kungoko u-`s[::-1]` eguqula i-string."
        },
        {
          "caption": "Omabini la maphethini aye abuzwa, phantse igama negama, kwiimviwo ezidlulileyo."
        }
      ]
    },
    {
      "title": "Ukuhamba ngasemva: amanyathelo angalunganga",
      "blocks": [
        {
          "text": "Inyathelo elibi liqhuba i-string ukusuka ngasemva ukuya phambili. Ukuhamba kuqala kwi-`start`, kugxuma kwizikhundla ze-`step` ngalo lonke ixesha, kwaye kuyeka xa kufikelela kwi-`stop`, ekufuneka ibe NGAPHAMBI kokuqala, okanye akukho nto iqokelelwe."
        },
        {
          "caption": "I-\"Jabberwocky\"[::-2] ityelela ii-indices 10, 8, 6, 4, 2, 0 ize ivelise i-'ycwebJ'."
        },
        {
          "head": [
            "Inkcazo",
            "Isiphumo",
            "Kutheni?"
          ]
        },
        {
          "title": "Impazamo eqhelekileyo: ukulindela iIndexError",
          "text": "I-Slicing akunakuze kuphakamise i-IndexError. Imida engaphandle komda ivalwe kwaye ukuhamba okungenakwenzeka kubuyisela i-string engenanto. Kuphela i-indexing yomlinganiswa omnye eqinileyo."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Iiphethini ezimbini zilawula amaphepha angaphambili: \"what is the value of `(expr)[a:b:-1]`\" no \"which slice of `w` produces this string\". Kwindidi yesibini, bhala ii-indices phantsi kweempawu ezijoliswe kuzo uze ufunde iphethini."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "`s[start:stop:step]`: ukuqala kubandakanyiwe, ukuyeka akuvumelekanga.",
            "Iimpawu ezisisiseko zenyathelo elilungileyo: ukuqala 0, ukuphela kokumisa, inyathelo 1. I-`s[:]` ikopa yonke i-string.",
            "I-negative-step defaults: qala kumlinganiswa wokugqibela, ume nje emva komlinganiswa wokuqala. `s[::-1]` iyajika.",
            "I-Slicing akunakuze kuphakamise i-IndexError, kwaye akunakwenzeka ukuba i-slices inike i-string engenanto.",
            "Ukulahla oonobumba bokuqala nabokugqibela: `s[1:-1]`. Ukuvavanya i-palindrome: `s == s[::-1]`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukuqikelela ukubuyela umva kweslice",
      "intro": "Eyona ndlela ixhaphakileyo yokuvavanya: i-concatenation, emva koko i-slice yenyathelo elibi. Yenza ngezigaba ezibini.",
      "steps": [
        {
          "text": "Qala usombulule ibinzana elithi: 'Ma'*2 yi 'MaMa', ngoko ke s yi 'GoMaMa', eyiimpawu ezintandathu, izikhombisi 0 ukuya ku-5 (okanye -6 ukuya ku -1)."
        },
        {
          "text": "I-slice iqala kwi -1: uphawu lokugqibela, `a` kwi-index 5."
        },
        {
          "text": "Inyathelo -1 lihambisa isikhundla esinye ngasekhohlo ngalo lonke ixesha: index -2 yi `M`, index -3 yi `a`."
        },
        null
      ]
    },
    {
      "title": "I-reverse-engineering ye-slice",
      "intro": "\"Which slice of w produces X?\" Yicombulule ngokubhala ii-indices phantsi kweempawu ezijoliswe kuzo.",
      "steps": [
        {
          "text": "Fumana umlinganiswa ngamnye ekujoliswe kuwo w kwaye uqaphele index: `o` yayo kwi 4, `t` kwi 2, `P` kwi 0."
        },
        {
          "text": "I-indices yehla nge-2 ngalo lonke ixesha, ngoko inyathelo -2. Ukuhamba kuqala kwi-4, eyi-index -2 ukusuka ngasemva."
        },
        {
          "text": "Emva ko-0 ukuhamba kufuneka kuhambe ngaphambili, ngoko ushiye isithuba esingenanto: `w[-2::-2]` ivelisa 'otP'. Lumka: `w[::-2]` iqala kumlinganiswa wokugqibela kwaye inika 'nhy' endaweni yoko."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Slice Umatshini",
    "description": "Faka nayiphi na i-string uze usete ii-dials ezintathu, kwaye ushiye nayiphi na kuzo ingenanto ukuze usebenzise i-Python ngokungagqibekanga.",
    "defaults": {
      "text": "IJabberwocky"
    }
  }
};
