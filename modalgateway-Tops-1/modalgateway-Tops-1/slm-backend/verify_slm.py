from services.progress_engine import get_progress_engine
from services.learning_engine import get_learning_engine

def test_progress_engine():
    print("\n--- Testing Progress Engine ---")
    engine = get_progress_engine()
    
    # Test 1: Vague Comment (Should Fail)
    print("Test 1: Vague Comment ('done')")
    valid, reason, conf = engine.validate_completion({"title": "Fix Bug"}, "done")
    print(f"Result: {valid} (Reason: {reason})")
    assert not valid, "Should calculate risk as invalid for vague comment"

    # Test 2: Detailed Comment (Should Pass)
    print("Test 2: Detailed Comment")
    comment = "Fixed the bug by updating the regex pattern to handle case insensitivity. Tested with unit tests."
    valid, reason, conf = engine.validate_completion({"title": "Fix Bug"}, comment)
    print(f"Result: {valid} (Reason: {reason})")
    assert valid, "Should allow detailed comment"

def test_learning_engine():
    print("\n--- Testing Learning Engine ---")
    engine = get_learning_engine()
    
    # Test 1: Extract Learning
    print("Test 1: Extract Learning")
    text = "We realized that the database migration failed because of a missing geometric type."
    record = engine.extract_learning(text)
    print(f"Result: {record}")
    assert record is not None, "Should extract learning"
    assert "migration failed" in record["insight"].lower()

    # Test 2: No Learning
    print("Test 2: Normal Text")
    text = "Just checking in on the status."
    record = engine.extract_learning(text)
    print(f"Result: {record}")
    assert record is None, "Should not extract learning"
    
    # Test 3: Calculate Percentage (Feature 4)
    print("Test 3: Calculate Percentage")
    prog_engine = get_progress_engine()
    pct = prog_engine.calculate_percentage("build_guidance", "approved")
    print(f"Build Guidance (Approved) %: {pct}")
    assert pct == 60, "Should be 60%"
    
    pct_rejected = prog_engine.calculate_percentage("build_guidance", "rejected")
    print(f"Build Guidance (Rejected) %: {pct_rejected}")
    assert pct_rejected == 50, "Should be 50% (60 - 10)"

    # Test 4: Proactive Suggestion Logic (Feature 6 - Simulation)
    print("Test 4: Proactive Suggestion Query")
    # First seed a learning
    engine.extract_learning("I learned that api timeouts happen when the db is slow.")
    # Now query
    results = engine.query_relevant_learnings("Create a new api task for db")
    print(f"Query Results: {len(results)}")
    assert len(results) > 0, "Should find the relevant learning"
    print(f"Tip: {results[0]['insight']}")

if __name__ == "__main__":
    try:
        # Force UTF-8 for Windows Console
        import sys
        sys.stdout.reconfigure(encoding='utf-8')
        
        test_progress_engine()
        test_learning_engine()
        print("\n✅ All Tests Passed!")
    except AssertionError as e:
        print(f"\n❌ Test Failed: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
