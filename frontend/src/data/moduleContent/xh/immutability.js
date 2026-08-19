// isiXhosa translation of the 'String Immutability' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const immutabilityModuleXh = {
  "title": "String Ukungaguquki",
  "level": "Osaqalayo",
  "outcomes": [
    "Cacisa ukuba kutheni i-s[0] = \"x\" iphakamisa i-TypeError",
    "Qikelela into eyenzekayo xa isiphumo semethod silahlwa",
    "Yakha kwakhona i-\"changed\" string usebenzisa i-slicing kunye ne-concatenation",
    "Landela string variables ngokusebenzisa umsebenzi ubiza ngokuchanekileyo"
  ],
  "learnSections": [
    {
      "title": "I-Strings iqingqiwe ngamatye",
      "blocks": [
        {
          "text": "I-Indexing kukuvumela ukuba ufunde nawuphi na umlinganiswa, kodwa ungalokothi ubhale omnye. I-string **ayitshintshi**: xa yenziwe, iimpawu zayo zihlala zihleli ngonaphakade, njengonobumba obuqingqiweyo kwitrone. Unokukrola ilitye elitsha, kodwa awukwazi ukuhlela elidala."
        },
        null,
        {
          "title": "Ayitshintshi",
          "text": "Into engenakuguqulwa emva kokuba yenziwe. Strings, inani elipheleleyo kunye neetuples azitshintshi; lists azitshintshi."
        }
      ]
    },
    {
      "title": "Methods buyisela entsha strings",
      "blocks": [
        {
          "text": "Ukuba i-strings ayikwazi ukutshintsha, zenza ntoni i-`upper()` ne-`replace()`? Zakha zize zibuyisele i-string entsha."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukubiza i-method kwaye ungayinanzi imiphumo",
          "text": "Umgibe omnye oqhelekileyo wokungaguquguquki kwiimvavanyo: umgca onje nge`s.upper()` ngokwawo awutshintshi nto. Soloko ubuza: uyaphi i-string ebuyisiweyo?"
        },
        null
      ]
    },
    {
      "title": "Ukwakha ngokutsha endaweni yokuhlela",
      "blocks": [
        {
          "text": "Kwi-\"change\" enye inqaku, yakha i-string entsha kwiingcezu ze-slice endala: slice ejikeleze inqaku uze wenze i-concatenation yendawo endaweni yokutshintsha, emva koko ubophe i-variable kwakhona."
        },
        {
          "caption": "I-variable ngoku ibonisa i-string ENTSHA; endala iyalahlwa."
        },
        {
          "title": "Kutheni imisebenzi ayikwazi ukutshintsha iiparameter ze-string",
          "text": "Ngaphakathi komsebenzi, i-`s = s + \"!\"` yenza igama LENDAWO YOKWENENE (local) likhomba kwistring esitsha. I-variable yalowo ubizayo iseqhubeka ikhomba kweyantsimbi yokuqala, oku kukumiselo oluthandwayo kuviwo lombuzo othi \"yintoni echwethezwayo?\""
        },
        null
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "I-Strings ayitshintshi: i-`s[0] = \"x\"` ihlala iphakamisa i-TypeError.",
            "I-Methods efana ne-`upper()` ne-`replace()` ibuyisela i-strings entsha, kwaye eyokuqala ayizange iguqulwe.",
            "Umnxeba wemethod ongakhange ubambe umphumo awufumani nto ibonakalayo.",
            "Kwi-\"change\" i-string, yakha kwakhona: `s = \"b\" + s[1:]`.",
            "Ukubuyisela ipharamitha ye-string ngaphakathi komsebenzi akuchaphazeli i-variable yomnxeba."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Oonobumba abakhulu abaphelayo",
      "intro": "Landelela ngenyameko eli qhekeza lokuvavanya, kuba umgibe ulapho kwinto eyenzekayo kwixabiso lokubuya.",
      "steps": [
        {
          "text": "I-`s` ibotshelelwe kwi-string \"cat\" eneempawu ezintathu."
        },
        {
          "text": "I-`s.upper()` yakha i-string \"CAT\" entsha kwaye iyayibuyisela. Kodwa umgca awwenzi nto ngexabiso elibuyisiweyo, ngoko lilahlwa kwangoko. I-`s` isalathisa kwi-\"cat\"."
        },
        {
          "text": "Umzobo ubonisa i-string yokuqala, engaguqukiyo."
        }
      ]
    },
    {
      "title": "Ukutshintsha ileta ngendlela esemthethweni",
      "intro": "Awukwazi ukunikezela kwi-s[0], kodwa unako ukwakha i-string oyifunayo.",
      "steps": [
        {
          "text": "Injongo: ukuguqula i-\"mat\" ibe yi-\"cat\". Ukunikezelwa ngokuthe ngqo kwi-s[0] kuya kuphakamisa i-TypeError."
        },
        {
          "text": "`s[1:]` slices yonke into emva komlinganiswa wokuqala: \"at\". I-Slicing iyafunda, ngoko ivumelekile."
        },
        {
          "text": "I-\"c\" + \"at\" yakha i-string \"cat\" entsha, kwaye amanqaku okumiselwa aya kuyo. I-\"mat\" endala ishiywe nje."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "I-Explorer Yokufunda Kuphela",
    "description": "I-Indexing kunokufikelela nakuphi na umlinganiswa, kodwa kuphela ukuze uyifunde. Hlola iibhokisi, uze ukhumbule: akukho nkcazelo apha inokuze iyitshintshe.",
    "defaults": {
      "text": "engaguqukiyo"
    }
  }
};
