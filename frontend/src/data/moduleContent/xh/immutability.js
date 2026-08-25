// isiXhosa translation of the 'String Immutability' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const immutabilityModuleXh = {
  "title": "Ukunga-tshintshwa kweeString",
  "level": "Osaqalayo",
  "prerequisite": "Ukusika iString",
  "outcomes": [
    "Chaza ukuba kutheni i-s[0] = \"x\" iphakamisa i-TypeError",
    "Qikelela ukuba kuza kwenzeka ntoni xa isiphumo semethod silahlwa",
    "Yakha kwakhona i-\"changed\" string usebenzisa i-slicing kunye ne-concatenation",
    "Landela string variables ngokusebenzisa umsebenzi ubiza ngokuchanekileyo"
  ],
  "learnSections": [
    {
      "title": "Strings ziqengqelwe ngamatye",
      "blocks": [
        {
          "text": "I-Indexing ikuvumela ukuba ufunde nawuphi na umlinganiswa, kodwa ungaze ubhale omnye. I-string ** ayitshintshi**: xa yenziwe, iimpawu zayo zihlala zihleli ngonaphakade, njengeeleta eziqingqiweyo kwitrone. Unokukrola ilitye elitsha, kodwa awukwazi ukuhlela elidala  kwikhowudi, oko kuthetha ukudala i-string entsha kwaye ubeke i-variable kuyo; into yokuqala ye-string ayitshintshi."
        },
        null,
        {
          "title": "I-Immutable",
          "text": "Into engabikho nto emva kokuba yenziwe. Strings, amanani angcwele kunye nama-tuple ayitshintshi; lists ayitshintshi."
        }
      ]
    },
    {
      "title": "Methods ukubuya entsha strings",
      "blocks": [
        {
          "text": "Ukuba i-strings ayinakutshintsha, yintoni eyenziwa yi-`upper()` ne-`replace()`? Zakha zize zibuyele kwi-string entsha."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukubiza i-method kwaye ungayinanzi imiphumo",
          "text": "Umgibe omnye oqhelekileyo wokungaguquki kuvavanyo: umgca onje nge`s.upper()` ngokwawo awutshintshi nto. Soloko ubuza: UYA phi i-string ebuyisiweyo?"
        },
        null
      ]
    },
    {
      "title": "Ukwakha kwakhona endaweni yokuhlela",
      "blocks": [
        {
          "text": "Kwi-\"change\" enye inqaku, yakha i-string entsha kwiingcezu ze-XNUMXXX endala: slice ejikeleze inqaku kunye ne-concatenate indawo endaweni yokutshintsha, emva koko ubophe i-variable kwakhona."
        },
        {
          "caption": "I-variable ngoku ibonisa i-string ENTSHA; endala iyalahlwa."
        },
        {
          "title": "Kutheni imisebenzi ayikwazi ukutshintsha iiparameter ze-string",
          "text": "Ngaphakathi komsebenzi, i-`s = s + \"!\"` yenza igama le-LOCAL libonise i-string entsha. \"what is printed?\" variable"
        },
        null
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "I-Strings ayitshintshi: i-`s[0] = \"x\"` ihlala iphakamisa i-TypeError.",
            "Methods efana `upper()` kunye `replace()` babuyisela NEW strings, kwaye original ayisoze itshintshwe.",
            "Umnxeba wemethod ongakhange ubonwe awufezekisi nto ibonakalayo.",
            "Xa usiya ku\"change\", yiba neXstring, uyihlaziye: `s = \"b\" + s[1:]`.",
            "Ukubuyisela ipharamitha yestring ngaphakathi komsebenzi akuchaphazeli i-variable yomnxeba."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ileta enkulu elahlekileyo",
      "intro": "Landela eli nqaku lokuvavanya ngenyameko, kuba umgibe ukuza kwinto eyenzekayo kwixabiso lokubuya.",
      "steps": [
        {
          "text": "I-`s` iboshwe kwi-string \"cat\" eneempawu ezintathu."
        },
        {
          "text": "`s.upper()` yakha i-string \"CAT\" entsha kwaye iyayibuyisela. Kodwa umgca awwenzi nto ngexabiso elibuyisiweyo, ngoko ke lilahlwa kwangoko. `s` isalathisa kwi-\"cat\"."
        },
        {
          "text": "Umfanekiso ubonisa i-string yokuqala, engatshintshanga."
        }
      ]
    },
    {
      "title": "Ukutshintsha ileta ngendlela esemthethweni",
      "intro": "Awukwazi ukuyinika i-s[0], kodwa unokwenza i-string oyifunayo.",
      "steps": [
        {
          "text": "Injongo: ukuguqula i-\"mat\" ibe yi-\"cat\". Ukubelwa ngqo kwi-s[0] kuya kuphakamisa i-TypeError."
        },
        {
          "text": "`s[1:]` slices yonke into emva komlinganiswa wokuqala: \"at\". Slicing ifundeka, ngoko ke kuvunyelwe."
        },
        {
          "text": "\"c\" + \"at\" yakha i-string \"cat\" entsha, kwaye amanqaku okubhalisa aya kuyo. \"mat\""
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umhloli onga-tshintshiyo",
    "description": "Indexing inokufikelela nakuphi na umlinganiswa, kodwa kuphela ukuyifunda."
  }
};
