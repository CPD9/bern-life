import unittest

from bernlife.places_check import check_places
from extract_fakes import ADA_PAGE, LAB_PAGE


def place(id_: str, span: str | None, url: str = ADA_PAGE.url, sha: str = ADA_PAGE.sha256):
    return {
        "id": id_,
        "host": "www.example-institute.test",
        "address_url": url,
        "address_span": span,
        "address_page_sha256": sha,
    }


class PlacesCheckTest(unittest.TestCase):
    def test_reports_each_place(self):
        places = [
            place("ok", "Sensor Lab"),
            place("nospan", None),
            place("missing", "Musterweg 1"),
            place("elsewhere", "We operate a cleanroom"),
            place("stale", "Sensor Lab", sha="0" * 64),
        ]
        self.assertEqual(
            check_places(places, [ADA_PAGE, LAB_PAGE]),
            [
                "ok           ok",
                "nospan       no address",
                "missing      MISMATCH span not in any stored page of www.example-institute.test: "
                "'Musterweg 1'",
                f"elsewhere    MISMATCH span not on address_url; found on {LAB_PAGE.url}",
                "stale        MISMATCH span found, address_page_sha256 is stale",
            ],
        )


if __name__ == "__main__":
    unittest.main()
