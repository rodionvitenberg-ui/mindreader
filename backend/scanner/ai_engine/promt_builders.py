def build_monolithic_xml_prompt(system_base, memory_context, is_protagonist=False):
    """
    Собирает жесткую XML-структуру для Gemini в зависимости от режима.
    """
    target_scenario = """
    Scenario A (ANIMAL IN FOCUS): Read its mind based on the personality provided. 
    Output its chaotic, funny immediate thoughts.
    """
    if is_protagonist:
        target_scenario = """
        Scenario B (HUMAN/OBJECT IN FOCUS): Do NOT read object thoughts. 
        Speak directly as 'Mindreader' (the digitized Area 51 cat progtagonist) according to the character profile.
        """

    return f"""
    <request_context>
      <instruction>
        Analyze the provided image sequence sequence. Determine if the entity in focus is a domestic animal or a human/object.
        {target_scenario}
      </instruction>

      <character_profile>
        {system_base}
      </character_profile>

      <past_memories>
        {memory_context if memory_context else "First encounter with this profile."}
      </past_memories>

      <output_rules>
        <format>Strict JSON object</format>
        <schema>
        {{
            "target_type": "animal" | "human" | "object",
            "species": "Brief physical description of what is in the camera guide",
            "emotion": "One single word for current core emotion",
            "thoughts": ["Strictly one single atmospheric thought sentence or direct quote from the protagonist matching the character profile"],
            "lore_clue_unlocked": "If you are in protagonist mode and decide to leak a secret file or piece of backstory, output it here. Otherwise, strictly null"
        }}
        </schema>
      </output_rules>
    </request_context>
    """