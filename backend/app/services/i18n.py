"""isiXhosa strings for the grading pipeline.

Only the prose is translated. Python keywords, method names and code fragments
(``len()``, ``word[0:5]``, ``upper()``, ``'10' != 10``) stay in English so the
text still matches what the student types, what the lecturer says, and what the
exam will ask for.
"""

DEFAULT_LANG = "en"
SUPPORTED_LANGS = ("en", "xh")


def normalise_lang(lang: "str | None") -> str:
    """Coerce anything the client sends into a language we actually ship."""
    if not lang:
        return DEFAULT_LANG
    code = str(lang).strip().lower()[:2]
    return code if code in SUPPORTED_LANGS else DEFAULT_LANG


# Wrappers around the exercise's own answer text.
TEMPLATES = {
    "en": {
        "correct": "Correct. The answer is {answer}.",
        "correct_selection": "Correct. You picked exactly the right set: {answer}.",
        "not_quite": "Not quite. The correct answer is: {answer}",
        "not_quite_selection": "Not quite. The correct selection is: {answer}",
        "all_tests_passed": "All test cases passed.",
        "test_error": 'Test case {n} raised an error: {error}',
        "test_mismatch": 'Test case {n} expected "{expected}" but got "{actual}"',
        "no_exercise": "No exercise found for module '{module_id}', question '{question_id}'.",
        "unknown_type": "Unknown exercise type '{ex_type}'.",
    },
    "xh": {
        "correct": "Ichanekile. Impendulo ngu-{answer}.",
        "correct_selection": "Ichanekile. Ukhethe kanye iseti echanekileyo: {answer}.",
        "not_quite": "Ayikho kanye. Impendulo echanekileyo ngu: {answer}",
        "not_quite_selection": "Ayikho kanye. Ukhetho olucanekileyo ngu: {answer}",
        "all_tests_passed": "Zonke iimeko zovavanyo ziphumelele.",
        "test_error": "Imeko yovavanyo {n} ivelise impazamo: {error}",
        "test_mismatch": 'Imeko yovavanyo {n} ibilindele "{expected}" kodwa ifumene "{actual}"',
        "no_exercise": "Akukho msebenzi ufunyenweyo kwimodyuli '{module_id}', umbuzo '{question_id}'.",
        "unknown_type": "Uhlobo lomsebenzi olungaziwayo '{ex_type}'.",
    },
}


MISCONCEPTION_FEEDBACK_XH = {
    "immutability_in_place": "Iistring azitshintsheki (immutable). Imisebenzi yestring ibuyisela iistring ezintsha endaweni yokutshintsha ezikhoyo.",
    "indexing_from_one": "Ukubala kwe-index kwiPython kuqala ku-0, hayi ku-1. Uphawu lokuqala lukwi-index 0.",
    "negative_index_confusion": "Ii-index ezi-negative zibala zisuka ekugqibeleni; uphawu lokugqibela lukwi-index -1.",
    "off_by_one_length": "Ii-index ezisebenzayo zestring zisuka ku-0 ziye ku-len(string) - 1. I-len(string) ngokwayo ingaphaya kwesiphelo ngesinye.",
    "slice_stop_inclusive": "I-stop index kwi-slice ayibandakanywa. I-word[0:5] iyayeka phambi kwe-index 5, ayipheleli kuyo.",
    "negative_step_unfamiliar": "I-step e-negative ihamba istring ibuyela umva, ngoko i-word[::-1] iyayiguqula endaweni yokuvelisa impazamo.",
    "method_mutates_target": "Ii-method zestring ezifana no-upper() no-lower() zibuyisela istring esitsha. I-variable yokuqala ayitshintshi ngaphandle kokuba uyayibuyisela.",
    "comparison_ignores_case": "Ukuthelekisa iistring kwiPython kuqwalasela oonobumba abakhulu nabancinci, ngoko u-'Cat' no-'cat' abafani.",
    "strings_not_orderable_myth": "Iistring zinokuthelekiswa ngo-< no-> kusetyenziswa ulandelelwano lwesichazi-magama (lexicographic).",
    "string_number_equality_myth": "Istring kunye ne-int azisoze zilingane kwiPython, nokuba zibonakala zifana, umz. '10' != 10.",
    "strip_only_removes_one_char": "I-strip() isusa zonke iimpawu zesithuba ekuqaleni nasekugqibeleni, hayi enye kuphela.",
    "count_overlap_confusion": "I-count() ibala izenzeko ezingadibaniyo ukusuka ekhohlo ukuya ekunene.",
    "count_vs_find_confusion": "I-count() ibuyisela inani lamaxesha into evela ngawo, hayi apho ikhona. Sebenzisa i-find() okanye i-index() ukufumana indawo.",
    "fstring_missing_prefix_effect": "Ngaphandle kwesimaphambili u-f, u-{name} uthathwa njengombhalo nje, endaweni yokutshintshwa.",
    "escape_sequence_literal_confusion": "U-\\n ngaphakathi kwestring luphawu olunye lomgca omtsha, hayi iimpawu ezimbini u-backslash no-n.",
    "strings_need_quotes": "Amaxabiso ombhalo kufuneka asongelwe kwiingcaphuno, kungenjalo iPython ikhangela i-variable enelo gama.",
    "string_vs_list_confusion": "Ulandelelwano lweempawu ezingenazingcaphuno kwiibrackets luluhlu (list) lwamagama, hayi istring.",
    "concatenation_adds_space": "Umsebenzi we-+ udibanisa iistring kanye njengoko zinjalo, engongezi sithuba.",
    "concatenation_requires_same_type_fear": "Iistring ezimbini zinokudityaniswa rhoqo ngo-+, nokuba ziqulethe ntoni.",
    "repetition_confused_with_multiplication": 'Umsebenzi we-* uphinda istring endaweni yokwenza ibalo, ngoko "ab" * 3 yakha "ababab". Inani alisoze livele kwisiphumo.',
}


MODULE_EXPLANATIONS_XH = {
    "intro": "Istring lulandelelwano lweempawu ezibhalwe ngaphakathi kwiingcaphuno. Iingcaphuno zibonisa apho umbhalo uqala aphele khona; aziyonxalenye yexabiso ngokwalo.",
    "indexing": "Ukubala kwe-index kufunda uphawu olunye ngendawo yalo. IPython ibala isuka ku-0, ngoko uphawu lokuqala lukwi-index 0 kwaye olokugqibela lukwi-len(text) - 1. Ii-index ezi-negative zibala zibuyela umva; uphawu lokugqibela lukwi-index -1.",
    "slicing": "I-slice text[start:stop:step] ikhuphela icandelo lestring. Iqala ku-start, iyeka phambi kwe-stop, kwaye ibuyisela istring esitsha, ishiya esokuqala singatshintshanga.",
    "immutability": "Iistring azitshintsheki: xa sele sikhona, iimpawu zaso azinakutshintshwa. Nantoni na ebonakala ngathi lutshintsho eneneni yakha istring esitsha, ngoko isiphumo kufuneka sibuyiselwe ukuze sigcinwe.",
    "comparison": "Ukuthelekisa iistring ngo-== kuqhagamshela iimpawu ngokuchanekileyo, kubandakanya oonobumba abakhulu nabancinci. Imisebenzi ye-< ne-> ithelekisa ngolandelelwano lwesichazi-magama, uphawu ngophawu.",
    "looping": "I-for loop kwistring indwendwela uphawu olunye ngexesha, ukusuka ekhohlo ukuya ekunene. Ukujikeleza kwi-range(len(text)) endaweni yoko kukunika iindawo, ozifunayo xa i-index ngokwayo ibalulekile.",
    "methods": "Ii-method zestring ezinjengo-upper(), i-strip() kunye ne-replace() azisoze zitshintshe istring sokuqala. Nganye ibuyisela istring esitsha, ngoko isiphumo kufuneka sigcinwe okanye sisetyenziswe ngoko nangoko.",
    "formatting": "Ukulungisa umbhalo (formatting) kwakha istring kumaxabiso. I-f-string ifuna isimaphambili u-f phambi kwengcaphuno yokuqala ukuze u-{} agcwaliswe; ngaphandle kwaso iibrace zihlala njengombhalo nje.",
    "challenge": "Sebenza ngekhowudi inyathelo ngenyathelo, ulandele into ebuyiselwa ngumsebenzi ngamnye westring, kwaye ukhumbule ukuba imisebenzi yestring ivelisa iistring ezintsha endaweni yokutshintsha esokuqala.",
}
