import ollama
from typing import List, Dict, Any
import logging
import os

logger = logging.getLogger(__name__)

class LLMGateway:
    """Gateway for local LLM inference using Ollama"""
    
    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        slm_model: str = "llama3.2:3b-instruct-q4_K_M",
        llm_model: str = "llama3.1:8b-instruct-q4_K_M"
    ):
        self.ollama_host = ollama_host
        self.slm_model = slm_model
        self.llm_model = llm_model
        
        # Configure Ollama client
        os.environ['OLLAMA_HOST'] = ollama_host
        
        logger.info(f"LLM Gateway initialized")
        logger.info(f"SLM: {slm_model}")
        logger.info(f"LLM: {llm_model}")
    
    def query_slm(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Query Small Language Model (3B params)
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (lower = more deterministic)
            
        Returns:
            Response dict with 'response' and metadata
        """
        logger.debug(f"Querying SLM with {len(prompt)} chars")
        
        try:
            response = ollama.generate(
                model=self.slm_model,
                prompt=prompt,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "stop": ["</answer>", "\n\n\n"]
                }
            )
            
            return {
                "response": response['response'].strip(),
                "model": self.slm_model,
                "tokens": response.get('eval_count', 0)
            }
        
        except Exception as e:
            logger.error(f"SLM query failed: {e}")
            raise
    
    def query_llm(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 1024,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """
        Query Large Language Model (8B params)
        
        Args:
            messages: Chat messages [{"role": "user", "content": "..."}]
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            
        Returns:
            Response dict with 'response' and metadata
        """
        logger.debug(f"Querying LLM with {len(messages)} messages")
        
        try:
            response = ollama.chat(
                model=self.llm_model,
                messages=messages,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            )
            
            return {
                "response": response['message']['content'].strip(),
                "model": self.llm_model,
                "tokens": response.get('eval_count', 0)
            }
        
        except Exception as e:
            logger.error(f"LLM query failed: {e}")
            raise
    
    def _load_system_prompt(self) -> str:
        """Load system prompt from the mandated guardrail folder"""
        prompt_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), 
            "../../llm_guardrails_openai/system_prompt.txt"
        ))
        try:
            if os.path.exists(prompt_path):
                with open(prompt_path, "r") as f:
                    return f.read().strip()
        except Exception as e:
            logger.error(f"Failed to load system prompt from {prompt_path}: {e}")
        
        return "You are a Talent Ops assistant. Answer ONLY using the provided documents."

    def query_with_rag(
        self,
        query: str,
        retrieved_chunks: List[str],
        openai_client: any = None
    ) -> str:
        """
        Query with RAG context using OpenAI (Matches PDF Integration)
        """
        context = "\n\n---\n\n".join(retrieved_chunks)
        system_prompt = self._load_system_prompt()
        
        usr_prompt = f"Documents/Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"
        
        # Fallback to internal client if not provided
        client = openai_client
        if not client:
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found in environment variables")
            client = OpenAI(api_key=api_key)


        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": usr_prompt}
                ],
                temperature=0.0
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI RAG failed: {e}")
            return f"Error generating answer: {str(e)}"

# Global instance
_llm_gateway = None

def get_llm_gateway() -> LLMGateway:
    """Get or create singleton LLM gateway"""
    global _llm_gateway
    if _llm_gateway is None:
        _llm_gateway = LLMGateway()
    return _llm_gateway
